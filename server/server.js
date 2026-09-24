import express from "express";
import { config } from "dotenv";

config();

const port = process.env.PORT || 3000;

const app = express();

app.listen(port, () => {
  console.log("Server listening on " + port);
});
