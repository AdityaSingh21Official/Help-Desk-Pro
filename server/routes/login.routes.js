import express from "express";
import { validateLoginRequest } from "../middleware/data.middleware/loginDataValidation.middleware.js";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { loginRateLimit } from "../middleware/rateLimit.middleware/loginRateLimit.middleware.js";
import { userLogin } from "../controllers/userLogin.controller.js";
import { removeRefreshToken } from "../controllers/refreshToken.controller.js";
const loginRouter = express.Router();

loginRouter.post(
  "/auth/login",
  validateLoginRequest,
  loginRateLimit,
  userLogin,
);

loginRouter.delete("/auth/logout", verifyAccessToken, removeRefreshToken);

export default loginRouter;
