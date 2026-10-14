import dbConn from "../database/db.config.js";
import bcrypt from "bcryptjs";
import redisClient from "../database/redis.config.js";
import cacheGetOrSet from "../services/cache/caching.service.js";

async function newTicket(req, res) {
  //todo : add data validation middleware for incoming data
  // this controller assumes the data is valid! and ok!
  let tempConn;
  try {
    const { sub, desc, priority } = req.body;
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log("CONTROLLER ERROR : customer controller {newTicket}", error);

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

async function newPresonalApiKey(req, res) {
  let tempConn;
  try {
    const name = req.body.name;
    const userId = req.user.userId;
    const nameRegex = /^[a-zA-Z0-9._\-\s]{2,100}$/;

    if (!name || typeof name !== "string" || !nameRegex.test(name)) {
      return res.status(422).json({
        success: false,
        message: "Invalid Key Label",
      });
    }

    const newApiKey = crypto.randomUUID() + crypto.randomUUID();

    const apiKeyHash = await bcrypt.hash(newApiKey, 12);

    const apiPrefix =
      newApiKey.substring(0, 5) +
      "..." +
      newApiKey.substring(newApiKey.length - 6, newApiKey.length - 1);

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    await tempConn.query(
      `
      insert into api_key(apiKeyHash, ApiPrefix, isRevoked, Expiry, createdAt, cid, api_label, apiTier) 
      values(?, ? , 0 , now() + interval ? minute, now(), ? , ?, "free")
      `,
      [apiKeyHash, apiPrefix, process.env.FREE_API_EXPIRY, userId, name],
    );

    await tempConn.commit();
    await redisClient.del(`user:${userId}:api:data`);
    return res.status(200).json({
      success: true,
      message: "Api Key Generated",
      api_key: newApiKey,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log(
      "CONTROLLER ERROR : customer controller {newPresonalApiKey}",
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

async function getMyKeys(req, res) {
  try {
    const userId = Number(req.user.userId);

    const key = `user:${userId}:api:data`;
    const query = `select apikeyid, apiprefix, apitier, createdAt, isRevoked, api_label from api_key where cid = ?`;
    const params = [userId];
    const ttl = 300;

    const data = await cacheGetOrSet(key, query, params, ttl);

    if (!data || data.length === 0) {
      await redisClient.del(`user:${userId}:api:data`);
      return res.status(200).json({
        success: true,
        message: "No Data Found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: `${data.length} keys found for user ${userId}`,
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : customer.controller {getMyKeys}");

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function revokeMyKey(req, res) {
  let tempConn;
  try {
    const userId = req.user.userId;
    const apiKeyId = Number(req.user.apiKeyId);

    if (!apiKeyId || isNaN(apiKeyId) || apiKeyId < 10000) {
      return res.status(422).json({
        success: false,
        message: "Invalid Api Key",
      });
    }

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const [apiData] = await tempConn.query(
      `select apikeyid, isRevoked, cid, api_label from api_key where apikeyid = ? and cid = ? for update`,
      [apiKeyId, userId],
    );

    if (!apiData || !apiData.length) {
      await tempConn.rollback();
      return res.json(422).json({
        success: false,
        message: "inavlid api key",
      });
    }

    if (apiData[0].isRevoked) {
      await tempConn.rollback();
      return res.status(409).json({
        success: false,
        message: "Key already revoked",
      });
    }

    await tempConn.query(
      `
      update api_key set isRevoked = 1 where apikeyid = ? and cid = ?
      `,
      [apiKeyId, userId],
    );

    await tempConn.commit();
    await redisClient.del(`user:${userId}:api:data`);

    return res.status(200).json({
      success: true,
      message: `${apiData[0].api_label} Revoked Successfully`,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log("CONTROLLER ERROR : customer.controller {revokeKey}");

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

export { newPresonalApiKey, getMyKeys, revokeMyKey };
