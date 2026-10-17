import express from "express";
import { verifyAccessToken } from "../middleware/authorization.middleware/accessToken.verification.middleware.js";
import { isCustomerRole } from "../middleware/role.middleware.js/roleChecker.middleware.js";
import {
  newTicket,
  getMyKeys,
  newPresonalApiKey,
  revokeMyKey,
} from "../controllers/customer.controller.js";

import { checkNewTicketData } from "../middleware/data.middleware/ticketDataValidation.middleware.js";

const customerRouter = express.Router();

customerRouter.post(
  "/customer/newTicket",
  verifyAccessToken,
  isCustomerRole,
  checkNewTicketData,
  newTicket,
);

customerRouter.post(
  "/customer/newApiKey",
  verifyAccessToken,
  isCustomerRole,
  newPresonalApiKey,
);

customerRouter.get(
  "/customer/myKeys",
  verifyAccessToken,
  isCustomerRole,
  getMyKeys,
);

customerRouter.delete(
  "/customer/revokeApi",
  verifyAccessToken,
  isCustomerRole,
  revokeMyKey,
);

export default customerRouter;
