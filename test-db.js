const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function testConnection() {
  console.log("Testing MongoDB connection...");
  console.log("URI:", process.env.MONGODB_URI ? "Detected" : "Not found");

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`\n✅ SUCCESS: MongoDB Connected!`);
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);

    // Try a simple operation
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(
      `Available collections: ${collections.map((c) => c.name).join(", ") || "None (new database)"}`,
    );

    await mongoose.connection.close();
    console.log("\nConnection closed.");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ERROR: Connection failed!`);
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
