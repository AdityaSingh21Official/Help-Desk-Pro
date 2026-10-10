const API = "http://127.0.0.1:6901";

async function refreshTokenCheck() {
  try {
    const response = await fetch(`${API}/api/auth/refresh`, {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();

    if (response.ok && data.success === true) {
      localStorage.setItem("token", data.accessToken);
      return true;
    }
  } catch (err) {
    console.error("Refresh failed:", err);
  }
  return false;
}

function goToLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  window.location.replace("/public/login.html");
}

(async function accessTokenCheck() {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      const response = await fetch(`${API}/api/auth/access`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) return;
    } catch (err) {
      console.error("Access check failed:", err);
    }
  }

  if (await refreshTokenCheck()) return;

  goToLogin();
})();
