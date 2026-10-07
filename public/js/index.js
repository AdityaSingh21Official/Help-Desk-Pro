import { showToast } from "./toast.js";
import { emailVerify, passwordVerify } from "./dataValidation.js";

const loginError = document.getElementById("loginError");
const loginForm = document.getElementById("loginForm");
const emailBox = document.getElementById("email");
const passwordBox = document.getElementById("password");
const submitBtn = document.getElementById("loginBtn");
const notification = document.getElementById("toast");

document.addEventListener("DOMContentLoaded", () => {
  showToast("Please Log In To Continue");
});

submitBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const email = emailBox.value.trim();
  const password = passwordBox.value.trim();

  const emailOk = emailVerify(email);
  const passwordOk = passwordVerify(password);

  if (!emailOk.success) return showToast("Invalid Email", true);
  if (!passwordOk.success) return showToast("Invalid Password", true);

  const response = await fetch("http://localhost:6901/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok || data.success !== true)
    return showToast(data.message, true);

  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("userName", data.userName);

  const role = data.message.split(" ")[0];

  let nextLoc;
  if (role === "CUSTOMER") nextLoc = "customer-tickets.html";
  else if (role === "ADMIN") nextLoc = "admin-dashboard.html";
  else if (role === "AGENT") nextLoc = "agent-tickets.html";
  else return showToast("Error Occured Please Try Later", ture);

  showToast(data.message);
  setTimeout(() => {
    window.location.href = `/public/${nextLoc}`;
  }, 1000);
  return;
});
