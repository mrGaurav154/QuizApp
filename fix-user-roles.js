const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function fixUserRoles() {
  console.log("Fixing user roles in database...\n");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Update all users with role 'user' to 'teacher' (default role)
    const result = await mongoose.connection.db.collection("users").updateMany(
      { role: "user" },
      { $set: { role: "teacher" } }
    );

    console.log(`Updated ${result.modifiedCount} users from 'user' to 'teacher' role\n`);

    // Show all users now
    const users = await mongoose.connection.db.collection("users").find({}).toArray();
    console.log("Current users:");
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} - Role: ${user.role}`);
    });

    await mongoose.connection.close();
    console.log("\n✅ Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

fixUserRoles();
