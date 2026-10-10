import express from "express";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { isAdminRole } from "../middleware/role.middleware.js/roleChecker.middleware.js";
import {
  getAllAgents,
  addAgent,
  toggleAgentStatus,
} from "../controllers/admin.controller.js";
import { validateAgentData } from "../middleware/data.middleware/registrationDataValidation.middleware.js";
const adminRouter = express.Router();

adminRouter.get("/agents/all", verifyAccessToken, isAdminRole, getAllAgents);
adminRouter.post(
  "/agents/add",
  verifyAccessToken,
  isAdminRole,
  validateAgentData,
  addAgent,
);
adminRouter.put(
  "/agents/toggleStatus",
  verifyAccessToken,
  isAdminRole,
  toggleAgentStatus,
);
export default adminRouter;
