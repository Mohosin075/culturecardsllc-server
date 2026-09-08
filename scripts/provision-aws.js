require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  EC2Client,
  DescribeSecurityGroupsCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeKeyPairsCommand,
  CreateKeyPairCommand,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  RunInstancesCommand,
  DescribeAddressesCommand,
  AllocateAddressCommand,
  AssociateAddressCommand,
  CreateTagsCommand,
  waitUntilInstanceRunning
} = require('@aws-sdk/client-ec2');

const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand
} = require('@aws-sdk/client-s3');

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_BUCKET_NAME || 'areisco-media-storage';
const keyPairName = 'culturecards-deploy-key';
const securityGroupName = 'culturecards-sg';
const instanceTagName = 'culturecards-server';
const instanceType = 't3.large'; // 2 vCPU, 8 GB RAM
const eipTagName = 'culturecards-eip';

const ec2 = new EC2Client({ region, credentials });
const s3 = new S3Client({ region, credentials });

async function ensureS3Bucket() {
  console.log(`\n[1/6] Checking S3 Bucket: ${bucketName}...`);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✅ S3 Bucket already exists: ${bucketName}`);
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Creating S3 Bucket: ${bucketName}...`);
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`✅ S3 Bucket created successfully.`);
    } else {
      console.log(`Note on S3 bucket: ${err.message}`);
    }
  }

  // Ensure CORS is set so presigned uploads from frontend work
  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag']
          }
        ]
      }
    }));
    console.log(`✅ S3 CORS configuration applied.`);
  } catch (corsErr) {
    console.log(`CORS update warning (non-fatal):`, corsErr.message);
  }
}

async function ensureSecurityGroup() {
  console.log(`\n[2/6] Checking Security Group: ${securityGroupName}...`);
  try {
    const res = await ec2.send(new DescribeSecurityGroupsCommand({
      GroupNames: [securityGroupName]
    }));
    const sg = res.SecurityGroups[0];
    console.log(`✅ Security Group exists: ${sg.GroupId}`);
    return sg.GroupId;
  } catch (err) {
    if (err.name === 'InvalidGroup.NotFound') {
      console.log(`Creating Security Group: ${securityGroupName}...`);
      const createRes = await ec2.send(new CreateSecurityGroupCommand({
        GroupName: securityGroupName,
        Description: 'Security group for CultureCards API Server (api.areisco.com)'
      }));
      const sgId = createRes.GroupId;

      console.log(`Configuring Inbound Firewall Rules (Ports 22, 80, 443, 5001)...`);
      await ec2.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: sgId,
        IpPermissions: [
          {
            IpProtocol: 'tcp',
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'SSH access' }]
          },
          {
            IpProtocol: 'tcp',
            FromPort: 80,
            ToPort: 80,
            IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTP & SSL renewal' }]
          },
          {
            IpProtocol: 'tcp',
            FromPort: 443,
            ToPort: 443,
            IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTPS SSL traffic' }]
          },
          {
            IpProtocol: 'tcp',
            FromPort: 5001,
            ToPort: 5001,
            IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'Internal API port' }]
          }
        ]
      }));
      console.log(`✅ Security Group created and rules applied: ${sgId}`);
      return sgId;
    }
    throw err;
  }
}

async function ensureKeyPair() {
  console.log(`\n[3/6] Checking Key Pair: ${keyPairName}...`);
  const keyPath = path.join(__dirname, '..', 'deploy-key.pem');

  try {
    await ec2.send(new DescribeKeyPairsCommand({
      KeyNames: [keyPairName]
    }));
    console.log(`✅ Key Pair '${keyPairName}' exists in AWS.`);
    if (!fs.existsSync(keyPath)) {
      console.log(`⚠️ Note: deploy-key.pem not found locally. If needed for SSH, ensure you have the private key.`);
    }
    return keyPairName;
  } catch (err) {
    if (err.name === 'InvalidKeyPair.NotFound') {
      console.log(`Creating Key Pair '${keyPairName}'...`);
      const res = await ec2.send(new CreateKeyPairCommand({
        KeyName: keyPairName,
        KeyType: 'rsa',
        KeyFormat: 'pem'
      }));
      fs.writeFileSync(keyPath, res.KeyMaterial, { mode: 0o600 });
      console.log(`✅ Key Pair created and saved locally to: deploy-key.pem`);
      return keyPairName;
    }
    throw err;
  }
}

async function getLatestUbuntuAMI() {
  console.log(`\n[4/6] Finding latest Ubuntu 24.04 LTS AMI in ${region}...`);
  const res = await ec2.send(new DescribeImagesCommand({
    Owners: ['099720109477'], // Canonical
    Filters: [
      { Name: 'name', Values: ['ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*'] },
      { Name: 'state', Values: ['available'] },
      { Name: 'architecture', Values: ['x86_64'] }
    ]
  }));

  if (!res.Images || res.Images.length === 0) {
    throw new Error('No Ubuntu 24.04 AMI found');
  }

  // Sort by creation date descending
  res.Images.sort((a, b) => new Date(b.CreationDate) - new Date(a.CreationDate));
  const latest = res.Images[0];
  console.log(`✅ Selected AMI: ${latest.ImageId} (${latest.Name})`);
  return latest.ImageId;
}

function generateUserData() {
  const script = `#!/bin/bash
set -e

# 1. Setup 2GB Swap Memory
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. System update & package installations
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git redis-server nginx ffmpeg certbot python3-certbot-nginx

# 3. Install Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# 4. Enable and start background services
systemctl enable redis-server
systemctl start redis-server
systemctl enable nginx
systemctl start nginx

# 5. Create app deployment directory
mkdir -p /var/www/culturecardsllc-server
chown -R ubuntu:ubuntu /var/www/culturecardsllc-server

# 6. Configure Nginx for api.areisco.com (with WebSockets & 100MB body size)
cat <<'EOF' > /etc/nginx/sites-available/api.areisco.com
server {
    listen 80;
    server_name api.areisco.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/api.areisco.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "Bootstrap complete!" > /var/log/bootstrap-complete.log
`;
  return Buffer.from(script).toString('base64');
}

async function ensureEC2Instance(sgId, amiId) {
  console.log(`\n[5/6] Checking EC2 Instance: ${instanceTagName} (${instanceType})...`);

  // Check if already running or pending
  const describeRes = await ec2.send(new DescribeInstancesCommand({
    Filters: [
      { Name: 'tag:Name', Values: [instanceTagName] },
      { Name: 'instance-state-name', Values: ['pending', 'running'] }
    ]
  }));

  const reservations = describeRes.Reservations || [];
  for (const r of reservations) {
    for (const inst of r.Instances || []) {
      console.log(`✅ Existing instance found: ${inst.InstanceId} (${inst.State.Name})`);
      return inst.InstanceId;
    }
  }

  console.log(`Launching new EC2 ${instanceType} instance with 30GB gp3 SSD & Ubuntu 24.04...`);
  const runRes = await ec2.send(new RunInstancesCommand({
    ImageId: amiId,
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: keyPairName,
    SecurityGroupIds: [sgId],
    UserData: generateUserData(),
    BlockDeviceMappings: [
      {
        DeviceName: '/dev/sda1',
        Ebs: {
          VolumeSize: 30,
          VolumeType: 'gp3',
          DeleteOnTermination: true
        }
      }
    ],
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: instanceTagName },
          { Key: 'Project', Value: 'CultureCards' },
          { Key: 'Domain', Value: 'api.areisco.com' }
        ]
      }
    ]
  }));

  const instanceId = runRes.Instances[0].InstanceId;
  console.log(`Launched instance: ${instanceId}. Waiting for instance to reach 'running' state...`);
  await waitUntilInstanceRunning({ client: ec2, maxWaitTime: 180 }, { InstanceIds: [instanceId] });
  console.log(`✅ EC2 Instance ${instanceId} is now RUNNING!`);
  return instanceId;
}

async function ensureElasticIP(instanceId) {
  console.log(`\n[6/6] Ensuring AWS Elastic IP (Static Public IPv4)...`);

  const describeRes = await ec2.send(new DescribeAddressesCommand({
    Filters: [{ Name: 'tag:Name', Values: [eipTagName] }]
  }));

  let allocationId;
  let publicIp;

  if (describeRes.Addresses && describeRes.Addresses.length > 0) {
    const addr = describeRes.Addresses[0];
    allocationId = addr.AllocationId;
    publicIp = addr.PublicIp;
    console.log(`Found existing Elastic IP: ${publicIp} (Allocation: ${allocationId})`);
  } else {
    console.log(`Allocating new AWS Elastic IP...`);
    const allocRes = await ec2.send(new AllocateAddressCommand({
      Domain: 'vpc',
      TagSpecifications: [
        {
          ResourceType: 'elastic-ip',
          Tags: [{ Key: 'Name', Value: eipTagName }]
        }
      ]
    }));
    allocationId = allocRes.AllocationId;
    publicIp = allocRes.PublicIp;
    console.log(`Allocated Elastic IP: ${publicIp}`);
  }

  console.log(`Associating Elastic IP ${publicIp} with instance ${instanceId}...`);
  await ec2.send(new AssociateAddressCommand({
    AllocationId: allocationId,
    InstanceId: instanceId
  }));
  console.log(`✅ Elastic IP successfully associated with ${instanceId}!`);

  return publicIp;
}

async function main() {
  console.log('=====================================================');
  console.log('  CultureCards & Areisco.com AWS Automation Script   ');
  console.log(`  Region: ${region} | Instance: ${instanceType}     `);
  console.log('=====================================================');

  try {
    await ensureS3Bucket();
    const sgId = await ensureSecurityGroup();
    await ensureKeyPair();
    const amiId = await getLatestUbuntuAMI();
    const instanceId = await ensureEC2Instance(sgId, amiId);
    const staticIp = await ensureElasticIP(instanceId);

    console.log('\n=====================================================');
    console.log('🎉 AWS INFRASTRUCTURE PROVISIONING COMPLETE!');
    console.log('=====================================================');
    console.log(`📍 EC2 Instance ID : ${instanceId}`);
    console.log(`💻 Instance Type   : ${instanceType} (2 vCPU, 8 GB RAM)`);
    console.log(`🌐 Elastic Public IP: ${staticIp}`);
    console.log(`🪣 S3 Bucket Name  : ${bucketName}`);
    console.log(`🔒 Security Group  : ${sgId}`);
    console.log('-----------------------------------------------------');
    console.log(`👉 IMMEDIATE ACTION FOR DOMAIN (api.areisco.com):`);
    console.log(`Add an 'A' record in your DNS (areisco.com):`);
    console.log(`  Type  : A`);
    console.log(`  Name  : api`);
    console.log(`  Value : ${staticIp}`);
    console.log('=====================================================\n');

    return { instanceId, staticIp, bucketName };
  } catch (error) {
    console.error('\n❌ Provisioning failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
