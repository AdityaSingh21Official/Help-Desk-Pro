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

function checkTicketSubject(sub) {
  const data = {
    success: true,
    message: "",
  };
  if (typeof sub !== "string") {
    data.success = false;
    data.message = "Invalid Subject";
    return data;
  }

  if (sub.length < 2) {
    data.success = false;
    data.message = "Minimum 2 characters in Subject";
    return data;
  }

  if (sub.length > 100) {
    data.success = false;
    data.message = "Maximum 100 characters in Subject";
    return data;
  }

  const titleRegex = /^[a-zA-Z0-9,._\-\s]{2,100}$/;
  if (!titleRegex.test(sub)) {
    data.success = false;
    data.message = "Invalid Characters in Subject";
    return data;
  }
  return data;
}

function checkTicketDescription(desc) {
  const data = {
    success: true,
    message: "",
  };
  if (typeof desc !== "string") {
    data.success = false;
    data.message = "Invalid Description";
    return data;
  }

  if (desc.length < 5 || desc.length > 2000) {
    data.success = false;
    data.message = "Description should be between 5 - 2k Characters";
    return data;
  }

  const descRegex = /^[a-zA-Z0-9,._:?()'"\s\-!;@#]{5,2000}$/;
  if (!descRegex.test(desc)) {
    data.success = false;
    data.message = "Invalid Characters in Description";
    return data;
  }

  return data;
}

export {
  emailVerify,
  passwordVerify,
  nameVerify,
  newPasswordValidate,
  checkTicketSubject,
  checkTicketDescription,
};
