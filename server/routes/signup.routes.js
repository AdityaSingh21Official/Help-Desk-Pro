import express from "express";
import {
  stageNewUser,
  registerNewUser,
} from "../controllers/userRegistration.controller.js";

const accountCreator = express.Router();

accountCreator.post("/auth/new/signup", stageNewUser);
accountCreator.post("/auth/verified/signup", registerNewUser);

export default accountCreator;
