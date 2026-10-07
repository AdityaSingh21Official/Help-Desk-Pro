import {
  emailVerify,
  passwordVerify,
  nameVerify,
  newPasswordValidate,
} from "./dataValidation.js";
import { showToast } from "./toast.js";

const fullNameBox = document.getElementById("fullName");
const emailBox = document.getElementById("signupEmail");
const signupPasswordBox = document.getElementById("signupPassword");
const confirmPasswordBox = document.getElementById("confirmPassword");
const signupBtn = document.getElementById("signupBtn");
const notification = document.getElementById("toast");
const fields = document.querySelectorAll(".otp-field");
const otpForm = document.getElementById("otpForm");
const signupForm = document.getElementById("signupForm");
const emailSentToBox = document.getElementById("emailSentToBox");
const wrongMailBox = document.getElementById("wrongMail");
const verifyBtn = document.getElementById("verifyBtn");
const goToSignup = document.getElementById("goToSignup");

let Gemail;

signupBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const fullName = fullNameBox.value.trim();
  const email = emailBox.value.trim();
  const password = signupPasswordBox.value;
  const confirmPassword = confirmPasswordBox.value;

  if (password !== confirmPassword)
    return showToast("Passwords Dont Match", true);

  const emailTest = emailVerify(email);
  if (!emailTest.success) return showToast(emailTest.message, true);
  const nameTest = nameVerify(fullName);
  if (!nameTest.success) return showToast(nameTest.message, true);
  const passwordTest = passwordVerify(password);
  if (!passwordTest.success) return showToast(passwordTest.message, true);
  const strongPasswordTest = newPasswordValidate(password);
  if (!strongPasswordTest.success)
    return showToast(strongPasswordTest.message, true, 5000);

  const response = await fetch("http://localhost:6901/api/auth/new/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fullName,
      email: email,
      password: password,
    }),
  });

  if (response.status === 404) {
    return showToast("Server Unreachable", true);
  }

  const data = await response.json();

  if (!response.ok || data.success == false) {
    return showToast(data.message, true, 4000);
  }

  Gemail = email;

  showOTP();
  emailSentToBox.innerText = `Verification Code Sent to ${email}`;
  return;
});

function showOTP(bool = true) {
  if (bool === true) {
    signupForm.classList.add("hidden");
    otpForm.classList.remove("hidden");
    wrongMailBox.remove("hidden");
    return;
  }
  if (bool == false) {
    signupForm.remove("hidden");
    otpForm.add("hidden");
    wrongMailBox.add("hidded");
    return;
  }
}

verifyBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  let otp = "";

  for (const field of fields) {
    const val = field.value.trim();
    if (val === "" || val === null || isNaN(val) || val.length !== 1) {
      return showToast("Invalid OTP", true);
    }

    otp += val;
  }

  const response = await fetch(
    "http://localhost:6901/api/auth/verified/signup",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: Gemail,
        OTP: otp,
      }),
    },
  );

  if (!response || response.status === 404)
    return showToast("Server Unreachable", true);

  const data = await response.json();

  if (!response.ok || data.success === false)
    return showToast(data.message, true);

  showToast(data.message, false, 3000);
  setTimeout(() => {
    window.location.href = "/public/index.html";
  }, 3000);
  return;
});

fields.forEach((field, index) => {
  field.addEventListener("input", (e) => {
    if (e.target.value.length === 1 && index < fields.length - 1) {
      fields[index + 1].focus();
    }
  });

  field.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && e.target.value.length === 0 && index > 0) {
      fields[index - 1].focus();
    }
  });
});

goToSignup.addEventListener("click", function () {
  showOTP(false);
  return;
});
