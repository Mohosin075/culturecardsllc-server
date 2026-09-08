const path = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')
const serverDir = path.resolve(__dirname, '..')
require(path.join(serverDir, 'node_modules/dotenv')).config({
  path: path.join(serverDir, '.env'),
})
const mongoose = require(path.join(serverDir, 'node_modules/mongoose'))

const uploadsDir = path.join(serverDir, 'uploads', 'images')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        // Handle HTTP redirects (Unsplash 302 redirects)
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return downloadFile(res.headers.location, destPath)
            .then(resolve)
            .catch(reject)
        }

        if (res.statusCode !== 200) {
          return reject(
            new Error(`Failed to download ${url}: status ${res.statusCode}`),
          )
        }

        const fileStream = fs.createWriteStream(destPath)
        res.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath))
        })
        fileStream.on('error', err => {
          fs.unlink(destPath, () => reject(err))
        })
      })
      .on('error', reject)
  })
}

function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
}

async function run() {
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error('DATABASE_URL not found!')
      process.exit(1)
    }

    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(dbUrl)
    console.log('✅ Connected.')

    const productsColl = mongoose.connection.db.collection('products')

    // Find products that have unsplash image URLs
    const products = await productsColl
      .find({
        images: { $elemMatch: { $regex: 'unsplash' } },
      })
      .toArray()

    console.log(
      `📸 Found ${products.length} products with Unsplash web images.`,
    )

    const urlToLocalPathMap = new Map()

    for (let i = 0; i < products.length; i++) {
      const prod = products[i]
      const updatedImages = []
      const prodSlug = sanitizeName(prod.title)

      console.log(`\n[${i + 1}/${products.length}] Processing: ${prod.title}`)

      for (let j = 0; j < prod.images.length; j++) {
        const imgUrl = prod.images[j]

        if (!imgUrl.startsWith('http')) {
          updatedImages.push(imgUrl)
          continue
        }

        if (urlToLocalPathMap.has(imgUrl)) {
          updatedImages.push(urlToLocalPathMap.get(imgUrl))
          console.log(`   ↳ Image ${j + 1}: Reusing cached local file`)
          continue
        }

        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${prodSlug}-${j + 1}.jpg`
        const localFilePath = path.join(uploadsDir, filename)
        const servePath = `/uploads/images/${filename}`

        console.log(`   ↳ Downloading image ${j + 1} to ${filename}...`)
        await downloadFile(imgUrl, localFilePath)
        const stats = fs.statSync(localFilePath)
        console.log(
          `     ✅ Downloaded (${(stats.size / 1024).toFixed(1)} KB) -> ${servePath}`,
        )

        urlToLocalPathMap.set(imgUrl, servePath)
        updatedImages.push(servePath)
      }

      await productsColl.updateOne(
        { _id: prod._id },
        { $set: { images: updatedImages, updatedAt: new Date() } },
      )
    }

    console.log('\n🎉 All product images downloaded and database updated!')

    // Verify sample
    const sample = await productsColl
      .find({
        _id: { $in: products.map(p => p._id) },
      })
      .project({ title: 1, images: 1 })
      .limit(3)
      .toArray()

    console.log('\nSample updated documents:')
    console.log(JSON.stringify(sample, null, 2))
  } catch (err) {
    console.error('❌ Error:', err)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected.')
    process.exit(0)
  }
}

run()
