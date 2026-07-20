require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');

async function testApi() {
  await mongoose.connect(process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'dasepat145@lasttea.com' });
  
  if (!user) {
    console.error("User not found");
    return;
  }
  
  const token = jwt.sign(
    { userId: user._id.toString(), role: user.activeRole },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  try {
    const res = await axios.get('http://127.0.0.1:5007/api/v1/trades/my', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.error('ERROR RESPONSE:', err.response?.data || err.message);
  }
  process.exit(0);
}

testApi();
