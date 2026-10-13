import express from "express";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { isAdminRole } from "../middleware/role.middleware.js/roleChecker.middleware.js";
import {
  getAllAgents,
  addAgent,
  toggleAgentStatus,
  newApiKey,
  getOrgKeys,
  getUserKeys,
  revokeThisKey,
  getOrgsData,
  getOrgMembers,
  addOrgs,
  removeOrg,
  addOrgMember,
  removeOrgMember,
} from "../controllers/admin.controller.js";
import {
  validateAgentData,
  validateNewMembertData,
} from "../middleware/data.middleware/registrationDataValidation.middleware.js";
import { validateApiCreationRequest } from "../middleware/data.middleware/apiDataValidation.middleware.js";

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

// adminRouter.put("/admin/metaData", verifyAccessToken, isAdminRole);
adminRouter.post(
  "/api-keys",
  verifyAccessToken,
  isAdminRole,
  validateApiCreationRequest,
  newApiKey,
);

adminRouter.get("/org-keys", verifyAccessToken, isAdminRole, getOrgKeys);
adminRouter.get("/user-keys", verifyAccessToken, isAdminRole, getUserKeys);
adminRouter.delete(
  "/revoke-key",
  verifyAccessToken,
  isAdminRole,
  revokeThisKey,
);

adminRouter.get("/orgs-data", verifyAccessToken, isAdminRole, getOrgsData);
adminRouter.put("/orgs-members", verifyAccessToken, isAdminRole, getOrgMembers);
adminRouter.post("/add-orgs", verifyAccessToken, isAdminRole, addOrgs);
adminRouter.delete("/remove-orgs", verifyAccessToken, isAdminRole, removeOrg);
adminRouter.post(
  "/orgs/newMember",
  verifyAccessToken,
  isAdminRole,
  validateNewMembertData,
  addOrgMember,
);
adminRouter.delete(
  "/orgs/remove-member",
  verifyAccessToken,
  isAdminRole,
  removeOrgMember,
);
export default adminRouter;
