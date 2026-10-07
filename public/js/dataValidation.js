function emailVerify(email) {
  const data = {
    success: true,
    message: "",
  };
  if (typeof email !== "string") {
    data.message = "Invalid Email Type";
    data.success = false;
    return data;
  }
  if (email.length > 100) {
    data.message = "Email too Long";
    data.success = false;
    return data;
  }
  if (email.length < 5) {
    data.message = "Email too Short";
    data.success = false;
    return data;
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9]{2,}$/;
  if (!emailRegex.test(email)) {
    data.message = "Invalid Email Format or Illegal Characters";
    data.success = false;
    return data;
  }

  return data;
}

function passwordVerify(password) {
  const data = {
    success: true,
    message: "",
  };
  if (typeof password !== "string") {
    data.message = "Invalid Password Type";
    data.success = false;
  }
  if (password.length < 8) {
    data.message = "Password should be Minimum  8 characters";
    data.success = false;
    return data;
  }

  if (password.length > 40) {
    data.message = "Password should be Maximum 40 characters";
    data.success = false;
    return data;
  }

  const passRegex = /^[a-zA-Z0-9!@#$%^&*()_+=\-[\]{};:,./?]{8,40}$/;
  if (!passRegex.test(password)) {
    data.message = "Invalid Characters in Password";
    data.success = false;
    return data;
  }

  return data;
}

function newPasswordValidate(password) {
  const newPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+=\-[\]{};:,./?\\|])[A-Za-z0-9!@#$%^&*()_+=\-[\]{};:,./?\\|]{8,40}$/;

  if (!newPasswordRegex.test(password)) {
    return {
      message:
        "Need atlease One Lowercase , One Uppercase , One Digit and One Specail Character",
      success: false,
    };
  }

  return { success: true };
}

function nameVerify(name) {
  const data = {
    success: true,
    message: "",
  };
  if (typeof name !== "string") {
    data.message = "Invalid Name";
    data.success = false;
    return data;
  }

  if (name.length > 120) {
    data.message = "Name too Long";
    data.success = false;
    return data;
  }

  if (name.length < 2) {
    data.message = "Name Too Short";
    data.success = false;
    return data;
  }

  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(name)) {
    data.message = "Invalid Characters in Name";
    data.success = false;
    return data;
  }

  return data;
}

export { emailVerify, passwordVerify, nameVerify, newPasswordValidate };
