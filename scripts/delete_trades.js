require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL).then(async () => {
  const db = mongoose.connection.db;
  const result = await db.collection('tradeoffers').deleteMany({
    $or: [
      { senderId: new mongoose.Types.ObjectId('6a5a975b96778d63ce4c6bd0') },
      { receiverId: new mongoose.Types.ObjectId('6a5a975b96778d63ce4c6bd0') }
    ]
  });
  console.log('DELETED:', result);
  process.exit(0);
}).catch(console.error);
