import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.log("Redis Client Error : " + error);
});

redisClient.on("connect", () => {
  console.log("Connecting to Redis. . .");
});

redisClient.on("ready", () => {
  console.log("✅ Redis connected");
});

export default redisClient;
