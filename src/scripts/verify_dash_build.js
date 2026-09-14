const { execSync } = require('child_process');

try {
  console.log('Building culture_dash...');
  const output = execSync('npm run build', {
    cwd: 'D:/Mohosin/projects/dashboard/culture_dash',
    encoding: 'utf8',
    env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://localhost:5001/api/v1' },
  });
  console.log(output);
  console.log('BUILD SUCCESSFUL!');
} catch (err) {
  console.error('BUILD FAILED:', err.stdout || err.message);
  process.exit(1);
}
