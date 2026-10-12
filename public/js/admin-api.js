import { showToast } from "./toast.js";

const createApiKeyBtn = document.getElementById("createApiKeyBtn");
const keyTierSelector = document.getElementById("keyTier");
const keyOrgNameContainer = document.getElementById("keyOrgName");

const appRoot = document.getElementById("appRoot");
const modal = document.getElementById("apiKeyModal");
const modalPanel = document.getElementById("apiKeyModalPanel");
const modalBackdrop = document.getElementById("apiKeyModalBackdrop");
const modalValue = document.getElementById("apiKeyModalValue");
const modalOrg = document.getElementById("apiKeyModalOrg");
const modalToggleBtn = document.getElementById("apiKeyModalToggleBtn");
const modalCopyBtn = document.getElementById("apiKeyModalCopyBtn");
const modalCopyLabel = document.getElementById("apiKeyModalCopyLabel");
const modalHint = document.getElementById("apiKeyModalHint");

const HINT_DEFAULT = "/ Store it somewhere safe, like a password manager.";
const HINT_WARN = "/ Copy your key first. It can't be shown again.";

let currentKey = "";
let revealed = false;
let copied = false;
let lastFocused = null;
let copyResetTimer = null;
let closeTimer = null;

createApiKeyBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const keyTier = keyTierSelector.value.toLowerCase();
  let keyOrgName = keyOrgNameContainer.value.trim();

  const orgNameRegex = /^[a-zA-Z0-9._\-]{0,100}$/;

  if (!orgNameRegex.test(keyOrgName)) {
    return showToast("Invalid Organization Name");
  }

  if (keyOrgName === "") keyOrgName = null;

  const allowedTiers = ["free", "pro"];

  if (!allowedTiers.includes(keyTier)) {
    return showToast("Only 'free' or 'pro' tier allowed");
  }

  createApiKeyBtn.disabled = true;

  try {
    const response = await fetch("http://127.0.0.1:6901/api/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        orgName: keyOrgName,
        tier: keyTier,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, true);
      return;
    }

    openKeyModal(data.api_key, keyOrgName || "");
    keyOrgNameContainer.value = "";
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    createApiKeyBtn.disabled = false;
  }
});

function maskKey(key) {
  if (key.length <= 12) return "•".repeat(key.length);
  return (
    key.slice(0, 8) + "•".repeat(Math.min(24, key.length - 12)) + key.slice(-4)
  );
}

function renderKey() {
  modalValue.textContent = revealed ? currentKey : maskKey(currentKey);
  modalToggleBtn.textContent = revealed ? "Hide" : "Show";
  modalToggleBtn.setAttribute("aria-pressed", String(revealed));
}

function setHint(text, warn = false) {
  modalHint.textContent = text;
  modalHint.classList.toggle("is-warn", warn);
}

function openKeyModal(key, org = "") {
  clearTimeout(closeTimer);
  clearTimeout(copyResetTimer);

  currentKey = key;
  revealed = false;
  copied = false;
  lastFocused = document.activeElement;

  modalOrg.textContent = org ? `/ ${org}` : "";
  setHint(HINT_DEFAULT);
  modalCopyLabel.textContent = "Copy key";
  renderKey();

  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  document.body.style.overflow = "hidden";

  modal.classList.add("is-open");
  appRoot.classList.add("hd-blurred");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.classList.add("is-visible");
      modalCopyBtn.focus();
    });
  });
}

function closeKeyModal() {
  if (!modal.classList.contains("is-open")) return;

  modal.classList.remove("is-visible");
  appRoot.classList.remove("hd-blurred");

  closeTimer = setTimeout(() => {
    modal.classList.remove("is-open");
    modalValue.textContent = "";
    currentKey = "";
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    clearTimeout(copyResetTimer);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }, 230);
}

function softClose() {
  if (copied) return closeKeyModal();

  setHint(HINT_WARN, true);
  modalPanel.classList.remove("hd-shake");
  void modalPanel.offsetWidth;
  modalPanel.classList.add("hd-shake");
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(currentKey);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = currentKey;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  copied = true;
  modalCopyLabel.textContent = "Copied ✓";
  setHint("/ Copied to clipboard.");

  clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    modalCopyLabel.textContent = "Copy key";
    setHint(HINT_DEFAULT);
  }, 2000);
}

modalCopyBtn.addEventListener("click", copyKey);

modalToggleBtn.addEventListener("click", () => {
  revealed = !revealed;
  renderKey();
});

document
  .getElementById("apiKeyModalClose")
  .addEventListener("click", closeKeyModal);
document
  .getElementById("apiKeyModalDoneBtn")
  .addEventListener("click", closeKeyModal);
modalBackdrop.addEventListener("click", softClose);

modal.addEventListener("click", (e) => {
  if (e.target === modal) softClose();
});

document.addEventListener("keydown", (e) => {
  if (!modal.classList.contains("is-open")) return;

  if (e.key === "Escape") {
    e.preventDefault();
    softClose();
    return;
  }

  if (e.key === "Tab") {
    const focusable = modalPanel.querySelectorAll("button:not([disabled])");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
