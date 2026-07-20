require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL).then(async () => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("Transaction started successfully.");
    await session.abortTransaction();
    session.endSession();
    process.exit(0);
  } catch (err) {
    console.error("Transaction Error:", err.message);
    process.exit(1);
  }
}).catch(console.error);
