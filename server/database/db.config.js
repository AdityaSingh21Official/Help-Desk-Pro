import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const dbConn = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

async function testConnection() {
  try {
    const test = await dbConn.getConnection();
    await test.ping();
    console.log("✅ DATABASE CONNECTED....");
    test.release();
    return;
  } catch (error) {
    throw new Error("❌ DATABASE CONNECTION ERROR ❌\n" + error);
  }
}

export default dbConn;
export { testConnection };
