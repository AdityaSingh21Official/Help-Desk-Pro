import mainConn from "../database/db.config";
import crypto from "crypto";
import jwt from "jsonwebtoken";

async function RefreshTokenVerification(req, res) {
  let tempConn;
  try {
    tempConn = await mainConn.getConnection();
    await tempConn.beginTransaction();

    const { refreshToken } = req.body;

    const hashedToken = crypto.hash("sha256", refreshToken, "hex");

    const [data] = await tempConn.query(
      `
        select *, now()>expiresAt as isExpired,
        timestampdiff(second, now(), expiresAt) as remainingSeconds
        from refresh_token 
        where tokenHash = ?
        for update;
        `,
      [hashedToken],
    );

    if (!data || data.length === 0) {
      await tempConn.commit();
      return res.status(401).json({
        success: false,
        message: "No Authentication",
      });
    }

    if (data[0]["revokedAt"] !== null) {
      await tempConn.commit();
      return res.status(401).json({
        success: false,
        message: "No Authentication",
      });
    }

    if (data[0]["isExpired"] == 1) {
      await tempConn.commit();
      return res.status(401).json({
        success: false,
        message: "No Authentication",
      });
    }

    let id;
    let role;

    const roles = {
      ADMIN: data[0]["aid"],
      AGENT: data[0]["agid"],
      CUSTOMER: data[0]["cid"],
    };

    for (const key in roles) {
      if (roles[key] !== null) {
        id = roles[key];
        role = key;
        break;
      }
    }

    const newAccessToken = jwt.sign(
      {
        userId: id,
        role: role,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      },
    );

    const newRefreshToken = crypto.randomUUID();
    const newHashedRefreshToken = crypto.hash("sha256", newRefreshToken, "hex");

    await tempConn.query(
      `
        update refresh_token
        set tokenhash = ?
        where RefreshTokenID = ?
        `,
      [newHashedRefreshToken, data[0]["RefreshTokenID"]],
    );

    await tempConn.commit();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/refresh",
      maxAge: data[0]["remainingSeconds"] * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "User Authenticated",
      accessToken: newAccessToken,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log(
      "CONTROLLER ERROR : refreshToken.controller {newRefreshToken}\n" + error,
    );

    return res.status(500).json({
      success: false,
      message: "INTERNVAL SERVER ERROR",
    });
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}

export { RefreshTokenVerification };
