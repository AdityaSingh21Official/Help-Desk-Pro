import express from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { testConnection } from "./database/db.config.js";
import newUserCreator from "./routes/signup.routes.js";
import loginRouter from "./routes/login.routes.js";
import tokenRouter from "./routes/token.routes.js";
import redisClient from "./database/redis.config.js";

config();

const port = process.env.PORT || 3000;

const app = express();

app.use(
  cors({
    origin: "http://127.0.0.1:5501",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api", newUserCreator);
app.use("/api", loginRouter);
app.use("/api", tokenRouter);

async function startServer() {
  try {
    console.log("|========REDIS========|");
    await redisClient.connect();
    console.log("=======================\n");
    console.log("|========MYSQL========|");
    await testConnection();
    console.log("=======================\n");
    console.log("|========SERVER========|");
    app.listen(port, function () {
      console.log(`Server Running On --> http://127.0.0.1:${port}\n\n`);
    });
  } catch (error) {
    console.log("-----------------Failed to start server-----------------");
  }
}

startServer();
