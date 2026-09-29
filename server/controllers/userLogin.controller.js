import mainConn from "../database/db.config.js";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";

config();

async function userLogin(req, res) {
  let tempConn;
  try {
    tempConn = await mainConn.getConnection();
    await tempConn.beginTransaction();

    const { email, password } = req.body;

    const [data] = await tempConn.query(
      `
      select u.id as id, u.password as password , u.type as type
      from (
      select cid as id , CPassword as password , "CUSTOMER" as type, CEmail as email from customer
      union all
      select aid as id, APassword as password , "ADMIN" as type, AEmail as email from admin
      union all
      select agid as id, AGPassword as password , "AGENT" as type, AGEmail as email from agent  
      ) u where u.email = ?;
      `,
      [email],
    );

    if (!data || data.length === 0) {
      await tempConn.rollback();
      return res.status(401).json({
        success: false,
        message: "INVALID CREDENTIALS",
      });
    }

    const passIsCorrect = await bcrypt.compare(password, data[0]["password"]);

    if (!passIsCorrect) {
      await tempConn.query(
        `
        update login_rate_limit 
        set failed_Count = failed_Count + 1 
        where login_key = ?;
        `,
        [email],
      );
      await tempConn.commit();
      return res.status(401).json({
        success: false,
        message: "INVALID CREDENTIALS",
      });
    }

    await tempConn.query(
      `
      delete from login_rate_limit
      where login_key = ?
      `,
      [email],
    );

    const accessToken = jwt.sign(
      {
        userId: data[0]["id"],
        role: data[0]["type"],
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      },
    );

    const rawRefreshToken = crypto.randomUUID();

    const hashedRefreshToken = crypto.hash("sha256", rawRefreshToken, "hex");

    const role = data[0]["type"];
    let colName;
    if (role === "CUSTOMER") {
      colName = "cid";
    } else if (role === "AGENT") {
      colName = "agid";
    } else if (role === "ADMIN") {
      colName = "aid";
    } else {
      await tempConn.rollback();
      return res.status(401).json({
        success: false,
        message: "CORRUPTED DATA",
      });
    }

    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY;

    await tempConn.query(
      `
      insert into refresh_token(tokenHash, expiresAt,${colName} )
      values(?, CURRENT_TIMESTAMP + interval ? minute , ?);
      `,
      [hashedRefreshToken, refreshExpiry, data[0]["id"]],
    );

    await tempConn.commit();

    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/refresh",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: `${data[0]["type"]} login succesfull`,
      accessToken: accessToken,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log(
      "CONTROLLER ERROR : userLogin.controller -> {userLogin}\n" + error,
    );

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}

export { userLogin };
