import { showToast } from "./toast.js";
import { emailVerify, passwordVerify } from "./dataValidation.js";

const API_BASE = "http://127.0.0.1:6901";

const FADE_MS = 250;
const MIN_LOADING_MS = 350;
const WELCOME_TOAST_DELAY_MS = 300;
const REDIRECT_MS = 1200;

const loginForm = document.getElementById("loginForm");
const emailBox = document.getElementById("email");
const passwordBox = document.getElementById("password");
const submitBtn = document.getElementById("loginBtn");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

document.body.style.transition = `opacity ${FADE_MS}ms ease`;

document.addEventListener("DOMContentLoaded", async () => {
  await wait(WELCOME_TOAST_DELAY_MS);
  showToast("Please Log In To Continue");
});

async function handleLogin(e) {
  e.preventDefault();

  if (submitBtn.disabled) return;

  const email = emailBox.value.trim();
  const password = passwordBox.value.trim();

  const emailOk = emailVerify(email);
  const passwordOk = passwordVerify(password);

  if (!emailOk.success) return showToast("Invalid Email", true);
  if (!passwordOk.success) return showToast("Invalid Password", true);

  const originalHtml = submitBtn.innerHTML;
  let keepLocked = false;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }),
      wait(MIN_LOADING_MS),
    ]);

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || data.success !== true) {
      return showToast(data.message || "Login failed", true);
    }

    const role = String(data.message || "").split(" ")[0];

    let nextLoc;
    if (role === "CUSTOMER") nextLoc = "customer-tickets.html";
    else if (role === "ADMIN") nextLoc = "admin-dashboard.html";
    else if (role === "AGENT") nextLoc = "agent-tickets.html";
    else return showToast("Error Occured Please Try Later", true);

    localStorage.setItem("token", data.accessToken);
    localStorage.setItem("userName", data.userName);

    keepLocked = true;
    submitBtn.textContent = "Welcome ✓";
    showToast(data.message);

    await wait(REDIRECT_MS);
    document.body.style.opacity = "0";
    await wait(FADE_MS);
    window.location.href = `/public/${nextLoc}`;
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    if (!keepLocked) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}

submitBtn.addEventListener("click", handleLogin);

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}
