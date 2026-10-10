import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const dbConn = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  flags: ["+FOUND_ROWS"],
});

async function testConnection() {
  try {
    console.log("MySQL Connecting . . .");
    const test = await dbConn.getConnection();
    await test.ping();
    console.log("✅ MySQL CONNECTED....");
    test.release();
    return;
  } catch (error) {
    throw new Error("❌ MySQL CONNECTION ERROR ❌\n" + error);
  }
}

export default dbConn;
export { testConnection };
