function checkOrgName(orgName) {
  if (typeof orgName !== "string") throw new Error("Bad Org Name");

  const orgNameRegex = /^[a-zA-Z0-9._\-\s]{2,100}$/;
  if (!orgNameRegex.test(orgName)) throw new Error("Bad Org Name");

  return;
}

function checkTier(tier) {
  if (typeof tier !== "string")
    throw new Error("Invalid Tier only 'free' or 'pro'");
  const allowedTiers = ["free", "pro"];
  if (!allowedTiers.includes(tier.toLowerCase()))
    throw new Error("Invalid Tier only 'free' or 'pro'");
  return tier.toLowerCase();
}

function validateApiCreationBody(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new Error("Invalid req body");
  if (Object.keys(body).length !== 2) throw new Error("Invalid req body");
  const allowedKeys = ["orgName", "tier"];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) throw new Error("Invalid req body");
  }
  return;
}

function validateApiCreationRequest(req, res, next) {
  try {
    const data = req.body;
    validateApiCreationBody(data);
    const { orgName, tier } = data;
    req.body.tier = checkTier(tier);
    checkOrgName(orgName);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export { validateApiCreationRequest };
