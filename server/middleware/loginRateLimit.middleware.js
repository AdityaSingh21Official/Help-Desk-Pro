import dbConn from "../database/db.config.js";
import { config } from "dotenv";

config();

/* ----------------- IMPORTANT NOTE !! ----------------------
This is only implemented for EMIAL rate limiting only

    !!DO NOT USE THIS FOR IP rate Limiting !!

If we use IP limiting, 
an attacker who owns one valid account could log into it between 
guesses and wipe their own IP counter.
-------------------------------------------------------------*/

async function loginRateLimit(req, res, next) {
  let tempConn;

  try {
    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const { email } = req.body;

    const [data] = await tempConn.query(
      `
            select *,
            now()>window_start+interval ? minute as windowExpired,
            now()>is_locked_until as lockExpired
            from login_rate_limit 
            where login_key = ?
            for update;
            `,
      [process.env.LOGIN_WINDOW_LIMIT, email],
    );

    if (!data || data.length === 0) {
      await tempConn.query(
        `
            insert into login_rate_limit(login_key, is_locked)
            values(?, ?);
            `,
        [email, 0],
      );
      await tempConn.commit();
      return next();
    }

    if (data[0]["is_locked"] == 1) {
      if (data[0]["lockExpired"] == 1) {
        await tempConn.query(
          `
            update login_rate_limit set 
            is_locked = 0,
            failed_count = 0,
            window_start = current_timestamp,
            is_locked_until = null
            where login_key = ?
            `,
          [email],
        );
        await tempConn.commit();
        return next();
      }

      await tempConn.commit();
      return res.status(429).json({
        success: false,
        message: "too many attetmps please try later",
      });
    }

    if (data[0]["windowExpired"] == 1) {
      await tempConn.query(
        `
        update login_rate_limit 
        set failed_count = 0,
        window_start = current_timestamp
        where login_key = ?
        `,
        [email],
      );

      await tempConn.commit();
      return next();
    }

    if (data[0]["failed_count"] >= Number(process.env.LOGIN_ATTEMPT_LIMIT)) {
      await tempConn.query(
        `
            update login_rate_limit 
            set is_locked = 1,
            is_locked_until = current_timestamp + interval ? minute
            where login_key = ?
            `,
        [process.env.LOGIN_TIMEOUT, email],
      );

      await tempConn.commit();

      return res.status(429).json({
        success: false,
        message: "Too many attemtps please try again later",
      });
    }

    await tempConn.commit();
    next();
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log(
      "MIDDLEWARE ERROR : loginRateLimit.middleware {loginRateLimit}\n" + error,
    );

    return res.status(500).json({
      success: false,
      message: "INTERNAL SERVER ERROR",
    });
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}

export { loginRateLimit };
