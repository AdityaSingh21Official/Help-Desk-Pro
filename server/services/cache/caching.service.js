import dbConn from "../../database/db.config.js";
import redisClient from "../../database/redis.config.js";

async function cacheGetOrSet(key, query, params, ttl) {
  try {
    try {
      const cache = await redisClient.get(key);
      if (cache !== null) {
        return JSON.parse(cache);
      }
    } catch (error) {
      console.log("Caching Servie Error : redis read error", error.message);
    }

    const [rows] = await dbConn.query(query, params);

    try {
      await redisClient.set(key, JSON.stringify(rows), { EX: ttl });
    } catch (error) {
      console.log("Caching Service Error : redis write error", error.message);
    }

    return rows;
  } catch (error) {
    console.log("Caching Service Error : MySQL Error", error.message);
  }
}

export default cacheGetOrSet;
