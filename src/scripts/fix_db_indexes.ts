import mongoose from 'mongoose'
import config from '../config'

async function fixIndexes() {
  try {
    await mongoose.connect(config.database_url as string)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    if (!db) throw new Error('DB connection failed')
    const collection = db.collection('partnerearnings')

    const indexes = await collection.indexes()
    console.log('Current indexes:', indexes.map(i => i.name))

    for (const idx of indexes) {
      if (idx.name && idx.name !== '_id_') {
        console.log(`Dropping index: ${idx.name}`)
        await collection.dropIndex(idx.name)
      }
    }

    console.log('Dropped old indexes successfully!')
    await mongoose.disconnect()
  } catch (err) {
    console.error('Error fixing indexes:', err)
  }
}

fixIndexes()
