import express from "express";
import {
  stageNewUser,
  registerNewUser,
} from "../controllers/userRegistration.controller.js";

import {
  validateStagingData,
  validateVerficationOTPData,
} from "../middleware/registrationDataValidation.middleware.js";

const accountCreator = express.Router();

accountCreator.post("/auth/new/signup", validateStagingData, stageNewUser);
accountCreator.post(
  "/auth/verified/signup",
  validateVerficationOTPData,
  registerNewUser,
);

export default accountCreator;
