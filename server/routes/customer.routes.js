import express from "express";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { isCustomerRole } from "../middleware/role.middleware.js/roleChecker.middleware.js";

const customerRouter = express.Router();

// customerRouter.post("/customer/newTicket", verifyAccessToken, isCustomerRole);

export default customerRouter;
