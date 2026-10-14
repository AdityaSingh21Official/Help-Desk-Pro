import { showToast } from "./toast.js";

const API_BASE = "http://127.0.0.1:6901/api";

const FADE_MS = 150;
const MIN_LOADING_MS = 350;
const MODAL_CLOSE_MS = 230;
const ROW_FADE_MS = 220;
const CONFIRM_CLOSE_DELAY_MS = 200;
const DEFAULT_RATE_LIMIT = 60;
const LABEL_REGEX = /^[a-zA-Z0-9._\-\s]{2,100}$/;
const USAGE_FIELDS = ["usagetoday", "usage", "requeststoday", "requestcount"];

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) console.warn(`Missing element #${id}`);
  return el;
};

const appRoot = $("appRoot");
const tableBody = $("myApiKeysTableBody");
const keyCount = $("keyCount");
const emptyState = $("keysEmptyState");
const form = $("createMyApiKeyForm");
const labelInput = $("keyLabel");
const createBtn = $("createMyApiKeyBtn");

const modal = $("apiKeyModal");
const modalPanel = $("apiKeyModalPanel");
const modalBackdrop = $("apiKeyModalBackdrop");
const modalValue = $("apiKeyModalValue");
const modalLabel = $("apiKeyModalLabel");
const modalToggleBtn = $("apiKeyModalToggleBtn");
const modalCopyBtn = $("apiKeyModalCopyBtn");
const modalCopyLabel = $("apiKeyModalCopyLabel");
const modalHint = $("apiKeyModalHint");

const revokeModal = $("revokeModal");
const revokeModalPanel = $("revokeModalPanel");
const revokeModalBackdrop = $("revokeModalBackdrop");
const revokeModalOwner = $("revokeModalOwner");
const revokeModalCloseBtn = $("revokeModalClose");
const revokeModalCancelBtn = $("revokeModalCancelBtn");
const revokeModalConfirmBtn = $("revokeModalConfirmBtn");

const usageTabs = document.querySelectorAll(".usage-tab");
const usagePanels = document.querySelectorAll(".usage-panel");
const usageCopyBtn = $("usageCopyBtn");

const HINT_DEFAULT = "/ Store it somewhere safe, like a password manager.";
const HINT_WARN = "/ Copy your key first. It can't be shown again.";

let currentKey = "";
let revealed = false;
let copied = false;
let lastFocused = null;
let copyResetTimer = null;
let closeTimer = null;
let loadToken = 0;
let creating = false;
let activeTab = "app";
let keysCache = [];

let pendingRevokeId = null;
let revokeLastFocused = null;
let revokeCloseTimer = null;
let revokeBusy = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (tableBody) tableBody.style.transition = `opacity ${FADE_MS}ms ease`;

loadKeys();

function fadeTable(visible) {
  if (tableBody) tableBody.style.opacity = visible ? "1" : "0";
}

function findRow(keyId) {
  return tableBody?.querySelector(
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

function pick(row, ...names) {
  const map = {};
  Object.keys(row).forEach((k) => {
    map[k.toLowerCase()] = row[k];
  });
  for (const name of names) {
    const value = map[name.toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function isRevokedValue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function usageHtml(row) {
  const raw = pick(row, ...USAGE_FIELDS);
  const used = Number(raw);
  const limit = Number(pick(row, "ratelimit", "limit")) || DEFAULT_RATE_LIMIT;

  if (raw === null || isNaN(used)) {
    return `<td class="px-6 py-4 key-usage-today text-xs text-white/40">—</td>`;
  }

  const percent = Math.min(100, Math.round((used / limit) * 100));

  return `<td class="px-6 py-4 key-usage-today">
    <div class="flex items-center gap-2">
      <div class="w-20 h-1.5 bg-white/10 overflow-hidden"><div class="h-full bg-[#feff7c]" style="width:${percent}%"></div></div>
      <span class="text-xs text-white/40 whitespace-nowrap">${used} / ${limit} req/min</span>
    </div>
  </td>`;
}

function statusHtml(revoked, expired) {
  if (revoked) {
    return `<span class="key-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-white/10 bg-white/5 text-white/40"><span class="w-1.5 h-1.5 bg-white/30"></span>Revoked</span>`;
  }
  if (expired) {
    return `<span class="key-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-[#ffb347]/30 bg-[#ffb347]/10 text-[#ffb347]"><span class="w-1.5 h-1.5 bg-[#ffb347]"></span>Expired</span>`;
  }
  return `<span class="key-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-[#6ee7a0]/30 bg-[#6ee7a0]/10 text-[#6ee7a0]"><span class="w-1.5 h-1.5 bg-[#6ee7a0]"></span>Active</span>`;
}

function rowHtml(row) {
  const id = pick(row, "apikeyid");
  const label = pick(row, "api_label", "apilabel") ?? "Untitled";
  const prefix = pick(row, "apiprefix", "apikeyprefix") ?? "—";
  const revoked = isRevokedValue(pick(row, "isrevoked"));
  const expiry = pick(row, "expiry");
  const expired = !revoked && !!expiry && new Date(expiry) < new Date();

  const action =
    revoked || expired
      ? `<td class="px-6 py-4 text-right text-xs text-white/20">—</td>`
      : `<td class="px-6 py-4 text-right"><button type="button" class="revokeKeyBtn text-[11px] uppercase text-[#ff8a8a] hover:text-[#ff6b6b] underline underline-offset-4 cursor-pointer transition-colors" data-key-id="${escapeHtml(id)}">Revoke</button></td>`;

  return `<tr class="api-key-row hover:bg-white/[0.03] transition-colors" data-key-id="${escapeHtml(id)}">
    <td class="px-6 py-4 key-label">${escapeHtml(label)}</td>
    <td class="px-6 py-4 text-xs text-white/40 key-masked-value whitespace-nowrap">${escapeHtml(prefix)}</td>
    ${usageHtml(row)}
    <td class="px-6 py-4 text-xs text-white/40 whitespace-nowrap key-created-at">${formatDate(pick(row, "createdat"))}</td>
    <td class="px-6 py-4">${statusHtml(revoked, expired)}</td>
    ${action}
  </tr>`;
}

function messageRowHtml(text, isError = false) {
  const color = isError ? "text-[#ff8a8a]" : "text-white/40";
  return `<tr><td colspan="6" class="px-6 py-10 text-center text-xs uppercase ${color}">${escapeHtml(text)}</td></tr>`;
}

function renderRows(rows) {
  if (!rows.length) {
    tableBody.innerHTML = "";
    keyCount.textContent = "0 keys";
    emptyState?.classList.remove("hidden");
    return;
  }
  emptyState?.classList.add("hidden");
  keyCount.textContent = `${rows.length} ${rows.length === 1 ? "key" : "keys"}`;
  tableBody.innerHTML = rows.map(rowHtml).join("");
}

async function loadKeys({ silent = false } = {}) {
  const token = ++loadToken;

  if (!silent) {
    fadeTable(false);
    await wait(FADE_MS);
    if (token !== loadToken) return;
    emptyState?.classList.add("hidden");
    keyCount.textContent = "Loading...";
    tableBody.innerHTML = messageRowHtml("Loading...");
    fadeTable(true);
  }

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/customer/myKeys`, {
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
        keyCount.textContent = "Error";
        tableBody.innerHTML = messageRowHtml(
          data.message || "Failed to load keys",
          true,
        );
        fadeTable(true);
      }
      showToast(data.message || "Failed to load keys", true);
      return;
    }

    keysCache = Array.isArray(data.data) ? data.data : [];
    renderRows(keysCache);
    fadeTable(true);
  } catch (err) {
    console.error("loadKeys failed:", err);
    if (token !== loadToken) return;
    if (!silent) {
      keyCount.textContent = "Error";
      tableBody.innerHTML = messageRowHtml("Could not reach the server", true);
      fadeTable(true);
    }
    showToast("Could not reach the server", true);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (creating) return;

  const name = labelInput.value.trim();

  if (!LABEL_REGEX.test(name)) {
    showToast("Label must be 2-100 letters, numbers, spaces . _ -", true);
    return;
  }

  creating = true;
  const originalText = createBtn.textContent;
  createBtn.disabled = true;
  createBtn.textContent = "Creating...";

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/customer/newApiKey`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      }),
      wait(MIN_LOADING_MS),
    ]);

    const data = await response.json();
    const ok = data.success ?? data.status;

    if (!ok || !data.api_key) {
      showToast(data.message || "Could not create key", true);
      return;
    }

    labelInput.value = "";
    openKeyModal(data.api_key, name);
    loadKeys({ silent: true });
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    creating = false;
    createBtn.disabled = false;
    createBtn.textContent = originalText;
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

function openKeyModal(key, label = "") {
  clearTimeout(closeTimer);
  clearTimeout(copyResetTimer);

  currentKey = key;
  revealed = false;
  copied = false;
  lastFocused = document.activeElement;

  modalLabel.textContent = label ? `/ ${label}` : "";
  setHint(HINT_DEFAULT);
  modalCopyLabel.textContent = "Copy key";
  renderKey();

  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  document.body.style.overflow = "hidden";

  modal.classList.add("is-open");
  appRoot?.classList.add("hd-blurred");

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
  appRoot?.classList.remove("hd-blurred");

  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    modal.classList.remove("is-open");
    modalValue.textContent = "";
    currentKey = "";
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    clearTimeout(copyResetTimer);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }, MODAL_CLOSE_MS);
}

function softClose() {
  if (copied) {
    closeKeyModal();
    return;
  }

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

modalCopyBtn?.addEventListener("click", copyKey);

modalToggleBtn?.addEventListener("click", () => {
  revealed = !revealed;
  renderKey();
});

$("apiKeyModalClose")?.addEventListener("click", closeKeyModal);
$("apiKeyModalDoneBtn")?.addEventListener("click", closeKeyModal);
modalBackdrop?.addEventListener("click", softClose);

modal?.addEventListener("click", (e) => {
  if (e.target === modal) softClose();
});

document.addEventListener("keydown", (e) => {
  if (!modal || !modal.classList.contains("is-open")) return;

  if (e.key === "Escape") {
    e.preventDefault();
    softClose();
    return;
  }

  if (e.key === "Tab") {
    const focusable = modalPanel.querySelectorAll("button:not([disabled])");
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

function openRevokeModal(keyId, labelText) {
  clearTimeout(revokeCloseTimer);

  pendingRevokeId = keyId;
  revokeLastFocused = document.activeElement;
  revokeModalOwner.textContent = labelText ? `/ ${labelText}` : "";

  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  document.body.style.overflow = "hidden";

  revokeModal.classList.add("is-open");
  appRoot?.classList.add("hd-blurred");

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
  appRoot?.classList.remove("hd-blurred");

  clearTimeout(revokeCloseTimer);
  revokeCloseTimer = setTimeout(() => {
    revokeModal.classList.remove("is-open");
    pendingRevokeId = null;
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    if (revokeLastFocused && revokeLastFocused.focus) revokeLastFocused.focus();
  }, MODAL_CLOSE_MS);
}

async function animateRevoke(keyId) {
  const row = findRow(keyId);
  if (row) {
    row.style.transition = `opacity ${ROW_FADE_MS}ms ease`;
    row.style.opacity = "0";
    await wait(ROW_FADE_MS);
  }
  renderRows(keysCache);
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
      fetch(`${API_BASE}/customer/revokeApi`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ apiKeyId: keyId }),
      }),
      wait(MIN_LOADING_MS),
    ]);

    console.log("revoke payload:", { apiKeyId: keyId }, typeof keyId);

    const data = await response.json();
    const ok = data.success ?? data.status;

    if (!ok) {
      showToast(data.message || "Could not revoke key", true);
    } else {
      revoked = true;
      message = data.message || "Key revoked";

      keysCache.forEach((row) => {
        const rowId = pick(row, "apikeyid");
        if (String(rowId) === String(keyId)) {
          Object.keys(row).forEach((k) => {
            if (k.toLowerCase() === "isrevoked") row[k] = 1;
          });
          if (pick(row, "isrevoked") === null) row.isRevoked = 1;
        }
      });
    }
  } catch (err) {
    console.error("confirmRevoke failed:", err);
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

tableBody?.addEventListener("click", (e) => {
  const btn = e.target.closest(".revokeKeyBtn");
  if (!btn) return;

  const raw = btn.dataset.keyId;
  if (!raw) {
    showToast("Key ID missing on this row", true);
    return;
  }

  const keyId = !isNaN(Number(raw)) ? Number(raw) : raw;
  const row = btn.closest("tr");
  const labelEl = row ? row.querySelector(".key-label") : null;

  openRevokeModal(keyId, labelEl ? labelEl.textContent : "");
});

revokeModalConfirmBtn?.addEventListener("click", confirmRevoke);
revokeModalCancelBtn?.addEventListener("click", closeRevokeModal);
revokeModalCloseBtn?.addEventListener("click", closeRevokeModal);
revokeModalBackdrop?.addEventListener("click", closeRevokeModal);

revokeModal?.addEventListener("click", (e) => {
  if (e.target === revokeModal) closeRevokeModal();
});

document.addEventListener("keydown", (e) => {
  if (!revokeModal || !revokeModal.classList.contains("is-open")) return;

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

usageTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    usageTabs.forEach((t) => {
      const isActive = t === tab;
      t.classList.toggle("border-[#feff7c]", isActive);
      t.classList.toggle("text-white", isActive);
      t.classList.toggle("border-transparent", !isActive);
      t.classList.toggle("text-white/40", !isActive);
    });

    usagePanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `usagePanel-${activeTab}`);
    });
  });
});

usageCopyBtn?.addEventListener("click", async () => {
  const code = document.querySelector(`#usagePanel-${activeTab} code`);
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code.textContent);
    usageCopyBtn.textContent = "Copied";
  } catch {
    showToast("Could not copy to clipboard", true);
    return;
  }
  setTimeout(() => (usageCopyBtn.textContent = "Copy"), 1500);
});
