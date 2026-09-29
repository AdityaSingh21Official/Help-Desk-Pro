import express from "express";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { validateRefreshToken } from "../middleware/data.middleware/refreshTokenValidation.middleware.js";
import { RefreshTokenVerification } from "../controllers/refreshToken.controller.js";
const tokenRouter = express.Router();

tokenRouter.get("/auth/access", verifyAccessToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User Ok",
  });
});

tokenRouter.post(
  "/auth/refresh",
  validateRefreshToken,
  RefreshTokenVerification,
);

export default tokenRouter;
