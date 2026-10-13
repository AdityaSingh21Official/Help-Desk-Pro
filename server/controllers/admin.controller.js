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

    let orgId;
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
    await redisClient.del("apikeys:list:orgs:data");
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

async function getOrgKeys(req, res) {
  try {
    const key = "apikeys:list:orgs:data";
    const query = `select a.apiKeyId, a.apiPrefix, a.apiTier, a.isRevoked, o.orgName 
      from api_key a join org o
      on a.orgId = o.orgId
      where a.orgId is not null;
      `;
    const params = [];
    const ttl = 600;

    const data = await cacheGetOrSet(key, query, params, ttl);

    return res.status(200).json({
      success: true,
      message: "Orgs Apis Fetched",
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : admin.controller {getOrgKeys}", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getUserKeys(req, res) {
  try {
    const key = "apikeys:list:singleUsers:data";
    const query = `select a.apiKeyId, a.apiPrefix, a.apiTier, a.isRevoked, c.Cname 
      from api_key a join customer c
      on a.cid = c.cid
      where a.cid is not null;
      `;
    const params = [];
    const ttl = 600;

    const data = await cacheGetOrSet(key, query, params, ttl);

    return res.status(200).json({
      status: true,
      message: "Users Api Fetched",
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : admin.controller {getUserKeys}", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function revokeThisKey(req, res) {
  let tempConn;
  try {
    const apiId = Number(req.body.apiId);

    if (isNaN(apiId)) {
      return res.status(422).json({
        success: false,
        message: "Invalid Api Id",
      });
    }

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const [metaData] = await tempConn.query(
      `
      select apikeyid, orgid, cid , isRevoked from api_key where apikeyid = ? for update
      `,
      [apiId],
    );

    if (!metaData.length) {
      await tempConn.rollback();
      return res.status(422).json({
        success: false,
        message: "Invalid Api Id",
      });
    }

    if (metaData[0]["isRevoked"] === 1) {
      await tempConn.rollback();
      return res.status(409).json({
        success: false,
        message: `Api : ${apiId} already revoked`,
      });
    }
    let cacheKey;
    if (metaData[0]["cid"] === null) cacheKey = "apikeys:list:orgs:data";
    else cacheKey = "apikeys:list:singleUsers:data";

    const [data] = await tempConn.query(
      `
      update api_key set isRevoked = 1
      where apikeyid = ?
      `,
      [apiId],
    );

    await tempConn.commit();
    await redisClient.del(cacheKey);

    return res.status(200).json({
      success: true,
      message: `Api : ${apiId} Revoked Successfully`,
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log("CONTROLLER ERROR : admin.controller {revokeThisKey}", error);

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

async function getOrgsData(req, res) {
  try {
    const key = "orgs:list:all";
    const query =
      "select  o.orgId ,o.orgName, count(c.cid) as members from org o left join customer c on c.orgId = o.orgId group by o.orgId;";
    const params = [];
    const ttl = 600;

    const data = await cacheGetOrSet(key, query, params, ttl);

    return res.status(200).json({
      success: true,
      message: "Organizations Fetched",
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : admin.controller {getOrgsData}", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getOrgMembers(req, res) {
  try {
    const orgId = Number(req.body.orgId);

    if (isNaN(orgId) || orgId < 900) {
      return res.status(422).json({
        success: false,
        message: "Invalid Organizaiton",
      });
    }

    const key = `org:members:${orgId}`;
    const query =
      "select c.cid, c.cname, c.cemail from customer c join org o on c.orgId = o.orgId where c.orgId = ?";
    const params = [orgId];
    const ttl = 300;

    const data = await cacheGetOrSet(key, query, params, ttl);

    if (!data || data.length === 0) {
      await redisClient.del(key);
      return res.status(422).json({
        success: false,
        message: "Invalid Organizaiton",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Data found for ${orgId}`,
      data: data,
    });
  } catch (error) {
    console.log("CONTROLLER ERROR : admin.controller {getOrgMembers}", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function addOrgs(req, res) {
  let tempConn;
  try {
    const orgName = req.body.orgName;
    const orgNameRegex = /^[a-zA-Z0-9._\-\s]{2,100}$/;

    if (typeof orgName !== "string" || !orgNameRegex.test(orgName)) {
      return res.status(422).json({
        success: false,
        message: "Invalid Org Name",
      });
    }

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    await tempConn.query(
      `
      insert into org(orgName) values(?);
      `,
      [orgName],
    );

    await tempConn.commit();
    await redisClient.del("orgs:list:all");
    return res.status(200).json({
      success: true,
      message: "Organization Added",
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log("CONTROLLER ERROR : admin.controller {addOrgs}", error);

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

async function removeOrg(req, res) {
  let tempConn;
  try {
    const orgId = Number(req.body.orgId);

    if (isNaN(orgId) || orgId < 900) {
      return res.status(422).json({
        success: false,
        message: "Invalid Organizaiton",
      });
    }

    tempConn = await dbConn.getConnection();
    await tempConn.beginTransaction();

    const [memberData] = await tempConn.query(
      `
    select
    (select count(*) from org where orgid = ?) as orgNumber,
    (select count(*) from customer where orgid = ?) as activeMembers,
    (select count(*) from api_key where orgid = ? and isRevoked = 0) as activeKeys;
    `,
      [orgId, orgId, orgId],
    );

    if (memberData[0]["orgNumber"] === 0) {
      await tempConn.rollback();
      return res.status(422).json({
        success: false,
        message: "No Organization found",
      });
    }

    if (
      memberData[0]["activeMembers"] !== 0 ||
      memberData[0]["activeKeys"] !== 0
    ) {
      await tempConn.rollback();
      return res.status(409).json({
        success: false,
        message: "Cannot Delete An Organizaiton With Active Members",
        data: {
          activeKeys: memberData[0]["activeKeys"],
          activeMembers: memberData[0]["activeMembers"],
        },
      });
    }

    await tempConn.query(
      `
      delete from org where orgId = ?
      `,
      [orgId],
    );

    await tempConn.commit();
    await redisClient.del("orgs:list:all");
    return res.status(200).json({
      success: true,
      message: "Removed Successfully",
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log("CONTROLLER ERROR : admin.controller {addOrgs}", error);

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

async function addOrgMember(req, res) {
  let tempConn;
  try {
    const { orgId, name, email, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 12);

    tempConn = await dbConn.getConnection();
    tempConn.beginTransaction();

    await tempConn.query(
      `
      insert into customer(cname, cemail, cpassword, orgId)
      values(?, ? ,? ,?)
      `,
      [name, email, passwordHash, orgId],
    );

    await tempConn.commit();
    await redisClient.del(`org:members:${orgId}`);
    await redisClient.del("orgs:list:all");

    sendNewEmail("newOrgMember", {
      subject: `Welcome to the team ${name}`,
      customerEmail: email,
      userName: name,
      password: password,
    });

    return res.status(200).json({
      success: true,
      message: "New Org Member Added",
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log("CONTROLLER ERROR : admin.controller {addOrgMember}", error);

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

async function removeOrgMember(req, res) {
  let tempConn;
  try {
    const orgId = Number(req.body.orgId);
    const cid = Number(req.body.cid);

    if (isNaN(orgId) || orgId < 900) {
      return res.status(422).json({
        success: false,
        message: "Invalid Organizaiton",
      });
    }

    if (isNaN(cid) || cid < 20100) {
      return res.status(422).json({
        success: false,
        message: "Invalid CID",
      });
    }

    tempConn = await dbConn.getConnection();
    tempConn.beginTransaction();

    const [data] = await tempConn.query(
      `delete from customer where
      cid = ? and 
      orgid = ?`,
      [cid, orgId],
    );

    if (data.affectedRows === 0) {
      await tempConn.rollback();
      return res.status(422).json({
        success: false,
        message: "Invalid Details",
      });
    }

    await tempConn.commit();
    await redisClient.del(`org:members:${orgId}`);
    await redisClient.del("orgs:list:all");
    return res.status(200).json({
      success: true,
      message: "Org Member Removed",
    });
  } catch (error) {
    if (tempConn) {
      await tempConn.rollback();
    }
    console.log("CONTROLLER ERROR : admin.controller {removeOrgMember}", error);

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

export {
  getAllAgents,
  addAgent,
  toggleAgentStatus,
  newApiKey,
  getOrgKeys,
  getUserKeys,
  revokeThisKey,
  getOrgsData,
  getOrgMembers,
  addOrgs,
  removeOrg,
  addOrgMember,
  removeOrgMember,
};
