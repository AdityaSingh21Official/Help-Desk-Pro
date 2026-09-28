import express from "express";
import { validateLoginRequest } from "../middleware/loginDataValidation.middleware.js";
import { loginRateLimit } from "../middleware/loginRateLimit.middleware.js";
import { userLogin } from "../controllers/userLogin.controller.js";
const loginRouter = express.Router();

loginRouter.post(
  "/auth/login",
  validateLoginRequest,
  loginRateLimit,
  userLogin,
);

export default loginRouter;
