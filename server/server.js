import express from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { testConnection } from "./database/db.config.js";
import newUserCreator from "./routes/signup.routes.js";
import loginRouter from "./routes/login.routes.js";
import tokenRouter from "./routes/token.routes.js";

config();

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api", newUserCreator);
app.use("/api", loginRouter);
app.use("/api", tokenRouter);

app.listen(port, async () => {
  await testConnection();
  console.log(`Server Started at http://localhost:${port}`);
});
