function isEmail(email) {
  if (typeof email !== "string") throw new Error("BAD EMAIL FORMAT");
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-_]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) throw new Error("BAD EMAIL FORMAT");
  return;
}
function validatePassword(password) {
  if (typeof password !== "string") throw new Error("BAD PASSWORD FORMAT");
  return;
}

function validateLoginReqBody(data) {
  if (typeof data !== "object") throw new Error("BAD REQUEST DATA");
  if (Object.keys(data).length !== 2) throw new Error("BAD REQUEST DATA");
  const allowedKeys = ["email", "password"];
  const hasAllKeys = allowedKeys.every((key) => key in data);
  if (!hasAllKeys) throw new Error("BAD REQUEST DATA");
  return;
}

function validateLoginRequest(req, res, next) {
  try {
    const data = req.body;
    validateLoginReqBody(data);
    const { email, password } = data;
    isEmail(email);
    validatePassword(password);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export { validateLoginRequest };
