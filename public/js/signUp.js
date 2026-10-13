import {
  emailVerify,
  passwordVerify,
  nameVerify,
  newPasswordValidate,
} from "./dataValidation.js";
import { showToast } from "./toast.js";

const API_BASE = "http://127.0.0.1:6901";

const FADE_MS = 200;
const MIN_LOADING_MS = 350;
const REDIRECT_MS = 1800;

const fullNameBox = document.getElementById("fullName");
const emailBox = document.getElementById("signupEmail");
const signupPasswordBox = document.getElementById("signupPassword");
const confirmPasswordBox = document.getElementById("confirmPassword");
const signupBtn = document.getElementById("signupBtn");
const fields = document.querySelectorAll(".otp-field");
const otpForm = document.getElementById("otpForm");
const signupForm = document.getElementById("signupForm");
const emailSentToBox = document.getElementById("emailSentToBox");
const wrongMailBox = document.getElementById("wrongMail");
const verifyBtn = document.getElementById("verifyBtn");
const goToSignup = document.getElementById("goToSignup");

let Gemail = "";
let switching = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

[signupForm, otpForm].forEach((form) => {
  form.style.transition = `opacity ${FADE_MS}ms ease`;
});

document.body.style.transition = `opacity ${FADE_MS}ms ease`;

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  return { ok: response.ok, status: response.status, json };
}

async function switchView(showOtp) {
  if (switching) return;
  switching = true;

  const from = showOtp ? signupForm : otpForm;
  const to = showOtp ? otpForm : signupForm;

  from.style.opacity = "0";
  await wait(FADE_MS);

  from.classList.add("hidden");
  to.style.opacity = "0";
  to.classList.remove("hidden");
  wrongMailBox.classList.toggle("hidden", !showOtp);

  if (!showOtp) {
    fields.forEach((field) => {
      field.value = "";
    });
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      to.style.opacity = "1";
      if (showOtp && fields[0]) fields[0].focus();
      if (!showOtp) fullNameBox.focus();
      switching = false;
    });
  });
}

signupBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  if (signupBtn.disabled) return;

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

  const originalHtml = signupBtn.innerHTML;
  signupBtn.disabled = true;
  signupBtn.textContent = "Creating account...";

  try {
    const [result] = await Promise.all([
      post("/api/auth/new/signup", {
        name: fullName,
        email,
        password,
      }),
      wait(MIN_LOADING_MS),
    ]);

    if (result.status === 404) {
      return showToast("Server Unreachable", true);
    }

    if (!result.ok || result.json.success === false) {
      return showToast(result.json.message || "Signup failed", true, 4000);
    }

    Gemail = email;
    emailSentToBox.textContent = `Verification Code Sent to ${email}`;
    await switchView(true);
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    signupBtn.disabled = false;
    signupBtn.innerHTML = originalHtml;
  }
});

verifyBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  if (verifyBtn.disabled) return;

  if (!Gemail) return showToast("Please sign up first", true);

  let otp = "";

  for (const field of fields) {
    const val = field.value.trim();
    if (val === "" || isNaN(val) || val.length !== 1) {
      return showToast("Invalid OTP", true);
    }
    otp += val;
  }

  const originalHtml = verifyBtn.innerHTML;
  let keepLocked = false;

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying...";

  try {
    const [result] = await Promise.all([
      post("/api/auth/verified/signup", { email: Gemail, OTP: otp }),
      wait(MIN_LOADING_MS),
    ]);

    if (result.status === 404) {
      return showToast("Server Unreachable", true);
    }

    if (!result.ok || result.json.success === false) {
      return showToast(result.json.message || "Verification failed", true);
    }

    keepLocked = true;
    verifyBtn.textContent = "Verified ✓";
    showToast(result.json.message, false, 3000);

    await wait(REDIRECT_MS);
    document.body.style.opacity = "0";
    await wait(FADE_MS);
    window.location.href = "/public/index.html";
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    if (!keepLocked) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = originalHtml;
    }
  }
});

fields.forEach((field, index) => {
  field.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 1);

    if (e.target.value.length === 1 && index < fields.length - 1) {
      fields[index + 1].focus();
    }
  });

  field.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && e.target.value.length === 0 && index > 0) {
      fields[index - 1].focus();
      return;
    }

    if (e.key === "Enter" && index === fields.length - 1) {
      e.preventDefault();
      verifyBtn.click();
    }
  });

  field.addEventListener("paste", (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "");
    if (!text) return;

    e.preventDefault();

    let last = index;
    for (let i = 0; i < text.length && index + i < fields.length; i++) {
      fields[index + i].value = text[i];
      last = index + i;
    }

    fields[Math.min(last + 1, fields.length - 1)].focus();
  });
});

goToSignup.addEventListener("click", function (e) {
  e.preventDefault();
  switchView(false);
});
