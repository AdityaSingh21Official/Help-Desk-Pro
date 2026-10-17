function checkTitle(sub) {
  if (typeof sub !== "string") throw new Error("Invalid Tittle");

  if (sub.length < 2 || sub.length > 100)
    throw new Error("Title Can Be 0 - 100 Character Only");

  const titleRegex = /^[a-zA-Z0-9,._\-\s]{2,100}$/;
  if (!titleRegex.test(sub)) throw new Error("Invalid Title");
  return;
}

function checkDescription(desc) {
  if (typeof desc !== "string") throw new Error("Invalid Problem Description");

  if (desc.length < 5 || desc.length > 2000)
    throw new Error("Description Can Be 0 - 2000 Character Only");

  const descRegex = /^[a-zA-Z0-9,._:?()'"\s\-!;@#]{5,2000}$/;
  if (!descRegex.test(desc)) throw new Error("Invalid Problem Description");

  return;
}

function checkPriority(priority) {
  if (typeof priority !== "string") throw new Error("Invalid Priority");

  const normalized = priority.trim().toLowerCase();
  const allowedPriorities = ["low", "high", "medium", "critical"];
  if (!allowedPriorities.includes(normalized))
    throw new Error("Invalid Priority");

  return normalized;
}

function checkIdemPotencyKey(idempoKey) {
  if (typeof idempoKey !== "string") throw new Error("Invalid Key");

  const UUIDRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!UUIDRegex.test(idempoKey)) throw new Error("Invalid Key");

  return;
}

function checkNewTicketReqBody(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new Error("Invalid Request");

  const allowedKeys = ["sub", "desc", "priority", "idempoKey"];
  const keys = Object.keys(body);
  if (keys.length !== 4) throw new Error("Invalid Request");

  for (const i of keys) {
    if (!allowedKeys.includes(i)) throw new Error("Invalid Request");
  }

  return;
}

function checkNewTicketData(req, res, next) {
  try {
    const data = req.body;
    checkNewTicketReqBody(data);
    const { sub, desc, priority, idempoKey } = data;
    checkTitle(sub);
    checkDescription(desc);
    checkIdemPotencyKey(idempoKey);
    req.body.priority = checkPriority(priority);

    next();
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: error.message,
    });
  }
}

export { checkNewTicketData };
