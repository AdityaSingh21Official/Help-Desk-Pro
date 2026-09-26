function isEmail(email) {
  if (typeof email !== "string") throw new Error("INVALID EMAIL");
  if (email.length > 100) throw new Error("INVALID EMAIL");
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) throw new Error("INVALID EMAIL");
  return;
}

function validatePassword(password) {
  if (typeof password !== "string") throw new Error("INVALID PASSWORD");
  if (password.length < 6) throw new Error("INVALID PASSWORD");
  if (password.length > 72) throw new Error("INVALID PASSWORD");
  return;
}

function validateName(name) {
  if (typeof name !== "string") throw new Error("Invalid Name");
  if (name.length > 100 || name.length <= 1) throw new Error("INVALID NAME");
  const nameRegex = /^[a-zA-Z0-9\s]+$/;
  if (!nameRegex.test(name)) throw new Error("INVALID NAME");
  return;
}

function validateOTP(otp) {
  if (typeof otp !== "string") throw new Error("BAD OTP");
  if (otp.length !== 6) throw new Error("BAD OTP");
  const OTPRegex = /^[0-9]+$/;
  if (!OTPRegex.test(otp)) throw new Error("BAD OTP");
  return;
}

function validateStagingBody(data) {
  if (typeof data !== "object") throw new Error("INVALID BODY");
  if (Object.keys(data).length !== 3) throw new Error("INVALID BODY");
  if (!("email" in data)) throw new Error("INVALID BODY");
  if (!("name" in data)) throw new Error("INVALID BODY");
  if (!("password" in data)) throw new Error("INVALID BODY");
  return;
}

function validateRegistrationBody(data) {
  if (typeof data !== "object") throw new Error("INVALID BODY");
  if (Object.keys(data).length !== 2) throw new Error("INVALID BODY");
  if (!("email" in data)) throw new Error("INVALID BODY");
  if (!("OTP" in data)) throw new Error("INVALID BODY");
  return;
}

function validateStagingData(req, res, next) {
  try {
    const data = req.body;
    validateStagingBody(data);
    const { email, password, name } = data;
    isEmail(email);
    validateName(name);
    validatePassword(password);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

function validateVerficationOTPData(req, res, next) {
  try {
    const data = req.body;
    validateRegistrationBody(data);
    const { email, OTP } = data;
    isEmail(email);
    validateOTP(OTP);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export { validateStagingData, validateVerficationOTPData };
