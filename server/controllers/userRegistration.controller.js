import dbConn from "../database/db.config.js";
import database from "../database/db.config.js";
import { sendNewEmail } from "../services/email/email.service.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function stageNewUser(req, res) {
  let tempConn;
  try {
    tempConn = await database.getConnection();
    await tempConn.beginTransaction();

    const { name, email, password } = req.body;

    const [data] = await tempConn.query(
      `
      select case 
      when exists (select 1 from customer_staging where cemail = ?) then "STAGED"
      when exists (select 1 from customer where cemail = ?) then "REGISTERED"
      else "NEW"
      end as Customer_is;
      `,
      [email, email],
    );

    if (data[0]["Customer_is"] === "STAGED") {
      const [OTPData] = await tempConn.query(
        `select now()>otpexpiresAt as expired from customer_Staging where cemail = ?`,
        [email],
      );

      if (OTPData[0]["expired"] === 0) {
        await tempConn.commit();
        return res.status(410).json({
          success: false,
          message: "Please Enter OTP from your Email to Register",
        });
      }

      const NewVerificationOTP = crypto.randomInt(100000, 1000000);

      const new_verification_OTP_Hash = await bcrypt.hash(
        NewVerificationOTP.toString(),
        12,
      );

      /* --------------------------
      OTP creationTime and expiryTime handled by database trigger "renew_opt_at"
      ----------------------------*/

      await tempConn.query(
        `update customer_staging 
        set OTPcodeHash = ?, attemptCount = 0, isFlagged = 0, isFlaggedUntil = null
        where CEmail = ?`,
        [new_verification_OTP_Hash, email],
      );

      await tempConn.commit();

      sendNewEmail("newUserVerificationEmail", {
        userName: name,
        verificationCode: NewVerificationOTP,
        customerEmail: email,
        subject: "Please Verify your email",
      });

      return res.status(200).json({
        success: true,
        message: `User Re-Staged Succesfully`,
      });
    }

    if (data[0]["Customer_is"] === "REGISTERED") {
      return res.status(409).json({
        success: false,
        message: "User already registerd please login to continue",
      });
    }

    const hashedPassowrd = await bcrypt.hash(password, 12);

    const verificationOTP = crypto.randomInt(100000, 1000000);

    const verification_OTP_Hash = await bcrypt.hash(
      verificationOTP.toString(),
      12,
    );

    await tempConn.query(
      "insert into customer_staging(CName, CEmail, CpasswordHash, OTPcodeHash) values(?, ?, ?, ?)",
      [name, email, hashedPassowrd, verification_OTP_Hash],
    );

    await tempConn.commit();

    sendNewEmail("newUserVerificationEmail", {
      userName: name,
      verificationCode: verificationOTP,
      customerEmail: email,
      subject: "Please Verify your email",
    });

    return res.status(200).json({
      success: true,
      message: `User Staged Succesfully`,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.error(
      "CONTROLLER ERROR : userRegistration.controller.js - > {registerUser}\n" +
        error,
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

async function registerNewUser(req, res) {
  let tempConn;
  try {
    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const { email, OTP } = req.body;

    const [data] = await tempConn.query(
      "select *,now()>otpexpiresAt as expired from customer_staging where cemail = ?",
      [email],
    );

    if (!data || data.length === 0) {
      await tempConn.rollback();
      return res.status(404).json({
        success: false,
        message: `No user found please Signup again`,
      });
    }

    if (data[0]["expired"] === 1) {
      await tempConn.commit();
      return res.status(410).json({
        success: true,
        message: `Request Expired`,
      });
    }

    if (data[0]["isFlagged"] === 1) {
      if (new Date() > new Date(data[0]["isFlaggedUntil"])) {
        await tempConn.query(
          `
          update customer_staging
          set attemptCount = 0, isFlagged = 0, isFlaggedUntil = null
          where CEmail = ?
          `,
          [email],
        );
        data[0]["attemptCount"] = 0;
        data[0]["isFlagged"] = 0;
        data[0]["isFlaggedUntil"] = null;
      } else {
        const timeRemainingMiliSeconds = new Date(
          data[0]["isFlaggedUntil"] - new Date(),
        );

        const timeRemainingHours = Math.round(
          timeRemainingMiliSeconds / (1000 * 60 * 60),
        );

        await tempConn.commit();

        if (timeRemainingHours > 0) {
          return res.status(403).json({
            success: false,
            message: `Too many Attempts try again after ${timeRemainingHours} hours`,
          });
        } else {
          return res.status(403).json({
            success: false,
            message: `Too many Attempts try again after ${Math.round(timeRemainingMiliSeconds / (1000 * 60))} minutes`,
          });
        }
      }
    }

    const correctOtp = await bcrypt.compare(OTP, data[0]["OTPcodeHash"]);

    if (correctOtp === false) {
      if (data[0]["attemptCount"] >= 4) {
        await tempConn.query(
          `update customer_staging 
          set attemptCount = attemptCount + 1,
          isFlagged = 1
          where Cemail = ?`,
          [email],
        );
      } else {
        await tempConn.query(
          "update customer_staging set attemptCount = attemptCount + 1 where Cemail = ?",
          [email],
        );
      }

      await tempConn.commit();

      return res.status(401).json({
        success: false,
        message: "Invalid OTP !",
      });
    }

    await tempConn.query(
      "insert into customer(Cname, CEmail, CPassword) values(?, ?, ?)",
      [data[0]["CName"], data[0]["CEmail"], data[0]["CpasswordHash"]],
    );

    await tempConn.query("delete from customer_staging where CEmail = ?", [
      email,
    ]);

    await tempConn.commit();

    return res.status(200).json({
      success: true,
      message: "User Registerd Succesfully",
    });
  } catch (error) {
    if (tempConn) {
      tempConn.rollback();
    }

    console.log(
      "CONTROLLER ERROR : userRegistration.controller.js {registerNewUser} \n" +
        error,
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
export { stageNewUser, registerNewUser };
