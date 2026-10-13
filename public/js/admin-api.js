import { showToast } from "./toast.js";

const API_BASE = "http://127.0.0.1:6901";
const ENDPOINTS = {
  org: "/api/org-keys",
  user: "/api/user-keys",
};

const FADE_MS = 150;
const MIN_LOADING_MS = 350;
const ROW_FADE_MS = 220;
const CONFIRM_CLOSE_DELAY_MS = 200;
const MODAL_CLOSE_MS = 260;

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

const tableBody = document.getElementById("apiKeysTableBody");
const ownerHead = document.getElementById("keyOwnerHead");
const viewOrgBtn = document.getElementById("viewOrgBtn");
const viewUserBtn = document.getElementById("viewUserBtn");

const revokeModal = document.getElementById("revokeModal");
const revokeModalPanel = document.getElementById("revokeModalPanel");
const revokeModalBackdrop = document.getElementById("revokeModalBackdrop");
const revokeModalOwner = document.getElementById("revokeModalOwner");
const revokeModalCloseBtn = document.getElementById("revokeModalClose");
const revokeModalCancelBtn = document.getElementById("revokeModalCancelBtn");
const revokeModalConfirmBtn = document.getElementById("revokeModalConfirmBtn");

const HINT_DEFAULT = "/ Store it somewhere safe, like a password manager.";
const HINT_WARN = "/ Copy your key first. It can't be shown again.";

const VIEW_ACTIVE_CLASSES = [
  "bg-[#feff7c]",
  "text-[#434302]",
  "border-[#feff7c]",
];
const VIEW_INACTIVE_CLASSES = [
  "bg-transparent",
  "text-white/60",
  "border-white/10",
  "hover:text-white",
  "hover:border-white/30",
];

let currentKey = "";
let revealed = false;
let copied = false;
let lastFocused = null;
let copyResetTimer = null;
let closeTimer = null;

let currentView = "org";
let loadToken = 0;
const keysCache = { org: [], user: [] };

let pendingRevokeId = null;
let revokeLastFocused = null;
let revokeCloseTimer = null;
let revokeBusy = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

tableBody.style.transition = `opacity ${FADE_MS}ms ease`;

function fadeTable(visible) {
  tableBody.style.opacity = visible ? "1" : "0";
}

function findRow(keyId) {
  return tableBody.querySelector(
    `tr[data-key-id="${CSS.escape(String(keyId))}"]`,
  );
}

function fadeInRow(keyId) {
  const row = findRow(keyId);
  if (!row) return;
  row.style.transition = `opacity ${FADE_MS}ms ease`;
  row.style.opacity = "0";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      row.style.opacity = "1";
    });
  });
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRevokedValue(value) {
  return value === true || value === 1 || value === "1";
}

function ownerOf(row, view) {
  return view === "org" ? row.orgName : row.Cname;
}

function tierPillHtml(tier) {
  const isPro = String(tier || "").toLowerCase() === "pro";
  const classes = isPro
    ? "border-[#feff7c]/30 bg-[#feff7c]/10 text-[#feff7c]"
    : "border-white/10 bg-white/5 text-white/60";
  return `<span class="key-tier-pill inline-flex px-2.5 py-1 text-[11px] uppercase border ${classes}">${escapeHtml(
    isPro ? "Pro" : "Free",
  )}</span>`;
}

function statusPillHtml(revoked) {
  if (revoked) {
    return `<span class="key-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-white/10 bg-white/5 text-white/40"><span class="w-1.5 h-1.5 bg-white/30"></span>Revoked</span>`;
  }
  return `<span class="key-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-[#6ee7a0]/30 bg-[#6ee7a0]/10 text-[#6ee7a0]"><span class="w-1.5 h-1.5 bg-[#6ee7a0]"></span>Active</span>`;
}

function rowHtml(row, view) {
  const revoked = isRevokedValue(row.isRevoked);
  const keyId = escapeHtml(row.apiKeyId);
  const action = revoked
    ? `<td class="px-6 py-4 text-right text-xs text-white/20">—</td>`
    : `<td class="px-6 py-4 text-right"><button class="revokeKeyBtn text-[11px] uppercase text-[#ff8a8a] hover:text-[#ff6b6b] underline underline-offset-4 cursor-pointer transition-colors" data-key-id="${keyId}">Revoke</button></td>`;

  return `<tr class="api-key-row hover:bg-white/[0.03] transition-colors" data-key-id="${keyId}">
    <td class="px-6 py-4 key-org-name">${escapeHtml(ownerOf(row, view))}</td>
    <td class="px-6 py-4 text-xs text-white/40 key-masked-value whitespace-nowrap">${escapeHtml(
      row.apiPrefix,
    )}</td>
    <td class="px-6 py-4">${tierPillHtml(row.apiTier)}</td>
    <td class="px-6 py-4 key-usage-today text-xs text-white/40">—</td>
    <td class="px-6 py-4">${statusPillHtml(revoked)}</td>
    ${action}
  </tr>`;
}

function messageRowHtml(text, isError = false) {
  const color = isError ? "text-[#ff8a8a]" : "text-white/40";
  return `<tr><td colspan="6" class="px-6 py-10 text-center text-xs uppercase ${color}">${escapeHtml(
    text,
  )}</td></tr>`;
}

function renderRows(view) {
  const rows = keysCache[view];
  if (!rows.length) {
    tableBody.innerHTML = messageRowHtml("No keys found");
    return;
  }
  tableBody.innerHTML = rows.map((row) => rowHtml(row, view)).join("");
}

function applyViewUi(view) {
  ownerHead.textContent = view === "org" ? "/ Organization" : "/ User";

  const pairs = [
    [viewOrgBtn, view === "org"],
    [viewUserBtn, view === "user"],
  ];

  pairs.forEach(([btn, active]) => {
    btn.classList.remove(...VIEW_ACTIVE_CLASSES, ...VIEW_INACTIVE_CLASSES);
    btn.classList.add(
      ...(active ? VIEW_ACTIVE_CLASSES : VIEW_INACTIVE_CLASSES),
    );
    btn.setAttribute("aria-pressed", String(active));
  });
}

async function loadKeys(view, { silent = false } = {}) {
  currentView = view;
  applyViewUi(view);
  const token = ++loadToken;

  if (!silent) {
    fadeTable(false);
    await wait(FADE_MS);
    if (token !== loadToken) return;
    tableBody.innerHTML = messageRowHtml("Loading...");
    fadeTable(true);
  }

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}${ENDPOINTS[view]}`, {
        method: "GET",
        headers: authHeaders(),
      }),
      silent ? Promise.resolve() : wait(MIN_LOADING_MS),
    ]);

    const data = await response.json();

    if (token !== loadToken) return;

    const ok = data.success ?? data.status;

    if (!silent) {
      fadeTable(false);
      await wait(FADE_MS);
      if (token !== loadToken) return;
    }

    if (!ok) {
      if (!silent) {
        tableBody.innerHTML = messageRowHtml(
          data.message || "Failed to load keys",
          true,
        );
        fadeTable(true);
      }
      showToast(data.message || "Failed to load keys", true);
      return;
    }

    keysCache[view] = Array.isArray(data.data) ? data.data : [];
    renderRows(view);
    fadeTable(true);
  } catch {
    if (token !== loadToken) return;
    if (!silent) {
      tableBody.innerHTML = messageRowHtml("Could not reach the server", true);
      fadeTable(true);
    }
    showToast("Could not reach the server", true);
  }
}

viewOrgBtn.addEventListener("click", () => {
  if (currentView === "org") return;
  loadKeys("org");
});

viewUserBtn.addEventListener("click", () => {
  if (currentView === "user") return;
  loadKeys("user");
});

createApiKeyBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const keyTier = keyTierSelector.value.toLowerCase();
  let keyOrgName = keyOrgNameContainer.value.trim();

  const orgNameRegex = /^[a-zA-Z0-9._\-]{2,100}$/;

  if (!orgNameRegex.test(keyOrgName)) {
    return showToast("Invalid Organization Name", true);
  }

  const allowedTiers = ["free", "pro"];

  if (!allowedTiers.includes(keyTier)) {
    return showToast("Only 'free' or 'pro' tier allowed", true);
  }

  const originalHtml = createApiKeyBtn.innerHTML;
  createApiKeyBtn.disabled = true;
  createApiKeyBtn.textContent = "Creating...";

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/api/api-keys`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          orgName: keyOrgName,
          tier: keyTier,
        }),
      }),
      wait(MIN_LOADING_MS),
    ]);

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, true);
      return;
    }

    keyOrgNameContainer.value = "";
    openKeyModal(data.api_key, keyOrgName || "");

    if (currentView === "org") loadKeys("org", { silent: true });
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    createApiKeyBtn.disabled = false;
    createApiKeyBtn.innerHTML = originalHtml;
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

function openRevokeModal(keyId, ownerName) {
  clearTimeout(revokeCloseTimer);

  pendingRevokeId = keyId;
  revokeLastFocused = document.activeElement;
  revokeModalOwner.textContent = ownerName ? `/ ${ownerName}` : "";

  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  document.body.style.overflow = "hidden";

  revokeModal.classList.add("is-open");
  appRoot.classList.add("hd-blurred");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      revokeModal.classList.add("is-visible");
      revokeModalCancelBtn.focus();
    });
  });
}

function closeRevokeModal() {
  if (!revokeModal.classList.contains("is-open") || revokeBusy) return;

  revokeModal.classList.remove("is-visible");
  appRoot.classList.remove("hd-blurred");

  revokeCloseTimer = setTimeout(() => {
    revokeModal.classList.remove("is-open");
    pendingRevokeId = null;
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    if (revokeLastFocused && revokeLastFocused.focus) revokeLastFocused.focus();
  }, 230);
}

async function animateRevoke(keyId) {
  const row = findRow(keyId);
  if (row) {
    row.style.transition = `opacity ${ROW_FADE_MS}ms ease`;
    row.style.opacity = "0";
    await wait(ROW_FADE_MS);
  }
  renderRows(currentView);
  fadeInRow(keyId);
}

async function confirmRevoke() {
  if (pendingRevokeId === null || revokeBusy) return;

  const keyId = pendingRevokeId;
  const originalLabel = revokeModalConfirmBtn.textContent;
  let revoked = false;
  let message = "";

  revokeBusy = true;
  revokeModalConfirmBtn.disabled = true;
  revokeModalCancelBtn.disabled = true;
  revokeModalConfirmBtn.textContent = "Revoking...";

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/api/revoke-key`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ apiId: keyId }),
      }),
      wait(MIN_LOADING_MS),
    ]);

    const data = await response.json();
    const ok = data.success ?? data.status;

    if (!ok) {
      showToast(data.message || "Could not revoke key", true);
    } else {
      revoked = true;
      message = data.message || "Key revoked";

      ["org", "user"].forEach((view) => {
        keysCache[view].forEach((row) => {
          if (String(row.apiKeyId) === String(keyId)) row.isRevoked = 1;
        });
      });
    }
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    revokeBusy = false;
    revokeModalConfirmBtn.disabled = false;
    revokeModalCancelBtn.disabled = false;
    revokeModalConfirmBtn.textContent = originalLabel;

    await wait(CONFIRM_CLOSE_DELAY_MS);
    closeRevokeModal();
  }

  if (revoked) {
    await wait(MODAL_CLOSE_MS);
    await animateRevoke(keyId);
    showToast(message);
  }
}

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".revokeKeyBtn");
  if (!btn) return;

  const keyId = btn.dataset.keyId;
  const row = btn.closest("tr");
  const ownerName = row ? row.querySelector(".key-org-name").textContent : "";

  openRevokeModal(keyId, ownerName);
});

revokeModalConfirmBtn.addEventListener("click", confirmRevoke);
revokeModalCancelBtn.addEventListener("click", closeRevokeModal);
revokeModalCloseBtn.addEventListener("click", closeRevokeModal);
revokeModalBackdrop.addEventListener("click", closeRevokeModal);

revokeModal.addEventListener("click", (e) => {
  if (e.target === revokeModal) closeRevokeModal();
});

document.addEventListener("keydown", (e) => {
  if (!revokeModal.classList.contains("is-open")) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeRevokeModal();
    return;
  }

  if (e.key === "Tab") {
    const focusable = revokeModalPanel.querySelectorAll(
      "button:not([disabled])",
    );
    if (!focusable.length) return;
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

loadKeys("org");
