import express from "express";
import { config } from "dotenv";
import { testConnection } from "./database/db.config.js";
import newUserCreator from "./routes/signup.routes.js";

config();

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());

app.use("/api", newUserCreator);

app.listen(port, async () => {
  await testConnection();
  console.log(`Server Started at http://localhost:${port}`);
});
