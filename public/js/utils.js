import { showToast } from "./toast.js";

const logoutBtn = document.getElementById("logoutBtn");
const adminName = document.getElementById("adminName");
const userAvatar = document.getElementById("userAvatar");

document.addEventListener("DOMContentLoaded", function () {
  renderUserName();
});

function renderUserName() {
  let userName = localStorage.getItem("userName");
  adminName.innerText = userName;
  userAvatar.textContent =
    userName.split(" ")[0].split("")[0] + userName.split(" ")[1].split("")[0];
}

logoutBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const response = await fetch("http://127.0.0.1:6901/api/auth/logout", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    return showToast("Server Unreachable Please Try Again", true, 4000);
  }

  showToast("Logout Successfull");
  localStorage.removeItem("token");
  localStorage.removeItem("userName");

  return window.location.replace("/public/index.html");
});
