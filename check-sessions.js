const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function checkSessions() {
  console.log("Checking sessions in MongoDB...\n");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const sessions = await mongoose.connection.db.collection("sessions").find({}).toArray();
    
    console.log(`Found ${sessions.length} active sessions:\n`);
    
    sessions.forEach((session, index) => {
      const sessionData = JSON.parse(session.session);
      console.log(`--- Session ${index + 1} ---`);
      console.log(`  Session ID: ${session._id}`);
      console.log(`  User ID: ${sessionData.userId || 'Not set'}`);
      console.log(`  Role: ${sessionData.role || 'Not set'}`);
      console.log(`  Email: ${sessionData.email || 'Not set'}`);
      console.log(`  Expires: ${session.expires}`);
      console.log('');
    });

    if (sessions.length === 0) {
      console.log("No active sessions found. Try logging in first!");
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

checkSessions();
