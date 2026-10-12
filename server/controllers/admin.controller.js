import dbConn from "../database/db.config.js";
import redisClient from "../database/redis.config.js";
import cacheGetOrSet from "../services/cache/caching.service.js";
import bcrypt from "bcryptjs";
import { sendNewEmail } from "../services/email/email.service.js";
import crypto from "crypto";

async function getAllAgents(req, res) {
  try {
    const key = "users:list:allagents:withData";
    const query = ` select AGID, AGName, AGEmail, AGLevel, IsActive 
                    from agent
    `;
    const params = [];
    const ttl = 600;

    const data = await cacheGetOrSet(key, query, params, ttl);

    return res.status(200).json({
      success: true,
      message: `${data.length} Agents Found`,
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : admin.controller {getAllAgents}\n" + error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function addAgent(req, res) {
  let tempConn;
  try {
    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();
    const aid = req.user.userId;
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    await tempConn.query(
      `insert into 
                        agent(agname, agemail , agpassword, aglevel, isActive, aid)
                        values(? , ? , ? , 0 , 1 , ?)
        `,
      [name, email, hashedPassword, aid],
    );

    await tempConn.commit();

    await redisClient.del("users:list:allagents:withData");

    sendNewEmail("newAgent", {
      subject: `Welcome to the team ${name}`,
      customerEmail: email,
      userName: name,
      password: password,
    });

    return res.status(200).json({
      success: true,
      message: `${name} Added`,
    });
  } catch (error) {
    if (tempConn) {
      tempConn.rollback();
    }

    if (error.errno === 1062) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    console.log("CONTROLLER ERROR : admin.controller {addAgent}", error);
    return res.json(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}

async function toggleAgentStatus(req, res) {
  let tempConn;
  try {
    const agid = Number(req.body.agid);

    if (isNaN(agid)) {
      return res.status(400).json({
        success: false,
        message: "Bad Agent ID",
      });
    }

    if (agid > 6000 || agid < 5000) {
      return res.status(422).json({
        success: false,
        message: "Invalid Agent ID",
      });
    }

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const [rows] = await tempConn.query(
      `
        select agid , IsActive , AGLevel from agent where agid = ? for update;
        `,
      [agid],
    );

    if (!rows.length) {
      await tempConn.rollback();
      return res.status(422).json({
        success: false,
        message: "Invalid Agent ID",
      });
    }

    if (rows[0]["AGLevel"] > 0 && rows[0]["IsActive"] == 1) {
      await tempConn.rollback();
      return res.status(409).json({
        success: false,
        message: "Cannot Deactivate an agent with active tickets",
      });
    }

    await tempConn.query(
      "update agent set isActive = !isActive where AGId = ?",
      [agid],
    );

    await tempConn.commit();
    await redisClient.del("users:list:allagents:withData");

    return res.status(200).json({
      success: true,
      message: "Agent Status Updated",
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();

      console.log(
        "CONTROLLER ERROR : admin.controller {toggleAgentStatus}",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Internal Server Errro",
      });
    }
  } finally {
    if (tempConn) {
      tempConn.release();
    }
  }
}

//------------------to be done-----------------------
/* async function getDashboardData(req, res) {
  try {
    const key = "admin:dashboard:all"
  } catch (error) {
    console.log(
      "CONTROLLER ERROR : admin.controller {getDashBoardData}",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Internal Server Errro",
    });
  }
} */

async function newApiKey(req, res) {
  let tempConn;
  try {
    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const { orgName, tier } = req.body;
    const aid = req.user.userId;

    let orgId = null;
    if (orgName != null) {
      const [orgData] = await tempConn.query(
        "select orgId from org where orgName = ? ",
        [orgName],
      );

      if (!orgData.length) {
        await tempConn.rollback();
        return res.status(409).json({
          success: false,
          message: `No Organization Named ${orgName} Found !!`,
        });
      }

      orgId = orgData[0]["orgId"];
    }

    const newApiKey = crypto.randomUUID() + crypto.randomUUID();

    const apiKeyHash = await bcrypt.hash(newApiKey, 12);

    const apiPrefix =
      newApiKey.substring(0, 5) +
      "..." +
      newApiKey.substring(newApiKey.length - 6, newApiKey.length - 1);

    let expiry = Number(process.env.FREE_API_EXPIRY);
    if (tier === "pro") {
      expiry = Number(process.env.PRO_API_EXPIRY);
    }

    await tempConn.query(
      `
        insert into 
        api_key(apikeyhash, apiprefix, apitier, isrevoked, expiry, createdAt, aid, orgId)
        values( ? , ? , ? , 0 , now() + interval ? minute , now() , ?, ?);
      `,
      [apiKeyHash, apiPrefix, tier, expiry, aid, orgId],
    );

    await tempConn.commit();
    return res.status(200).json({
      success: true,
      message: `New ${tier} API-KEY Generated`,
      api_key: newApiKey,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }

    console.log("CONTROLLER ERROR : admin.controller {newApiKey}", error);

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

export { getAllAgents, addAgent, toggleAgentStatus, newApiKey };
