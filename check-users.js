const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function checkUsers() {
  console.log("Checking users in database...\n");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get all users
    const users = await mongoose.connection.db.collection("users").find({}).toArray();
    
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`--- User ${index + 1} ---`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Has Password: ${user.password ? 'Yes' : 'NO (PROBLEM!)'}`);
      console.log(`  Institution: ${user.institution || 'N/A'}`);
      console.log(`  Organization: ${user.organization || 'N/A'}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

checkUsers();
