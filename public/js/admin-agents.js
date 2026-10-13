import { showToast } from "./toast.js";
import { emailVerify, nameVerify } from "./dataValidation.js";

const API_BASE = "http://127.0.0.1:6901";

const FADE_MS = 150;
const MIN_LOADING_MS = 350;
const ROW_FADE_MS = 250;
const BAR_MS = 500;

const agentsTableBody = document.getElementById("agentsTableBody");
const agentNameBox = document.getElementById("agentName");
const agentEmailBox = document.getElementById("agentEmail");
const addAgentBtn = document.getElementById("addAgentBtn");

let loadToken = 0;
let loadedOnce = false;
let knownIds = new Set();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

agentsTableBody.style.transition = `opacity ${FADE_MS}ms ease`;

function fadeTable(visible) {
  agentsTableBody.style.opacity = visible ? "1" : "0";
}

function findRow(agentId) {
  return agentsTableBody.querySelector(
    `tr[data-agent-id="${CSS.escape(String(agentId))}"]`,
  );
}

function fadeInRow(agentId) {
  const row = findRow(agentId);
  if (!row) return;
  row.style.transition = `opacity ${ROW_FADE_MS}ms ease`;
  row.style.opacity = "0";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      row.style.opacity = "1";
    });
  });
}

function animateBars() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      agentsTableBody.querySelectorAll(".workload-bar").forEach((bar) => {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  });
}

async function api(path, method, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  return { ok: response.ok, json };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isActiveValue(value) {
  return value === true || value === 1 || value === "1";
}

function messageRowHtml(text, isError = false) {
  const color = isError ? "text-[#ff8a8a]" : "text-white/40";
  return `<tr><td colspan="4" class="px-6 py-10 text-center text-xs uppercase ${color}">${escapeHtml(
    text,
  )}</td></tr>`;
}

function statusPillHtml(active) {
  if (active) {
    return `<span class="agent-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-[#6ee7a0]/30 bg-[#6ee7a0]/10 text-[#6ee7a0]"><span class="w-1.5 h-1.5 bg-[#6ee7a0]"></span>Active</span>`;
  }
  return `<span class="agent-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-white/10 bg-white/5 text-white/40"><span class="w-1.5 h-1.5 bg-white/30"></span>Inactive</span>`;
}

function actionBtnHtml(active) {
  if (active) {
    return `<button class="deactivateAgentBtn text-[11px] uppercase text-[#ff8a8a] hover:text-[#ff6b6b] underline underline-offset-4 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">Deactivate</button>`;
  }
  return `<button class="reactivateAgentBtn text-[11px] uppercase text-[#feff7c] hover:text-[#ffff47] underline underline-offset-4 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">Reactivate</button>`;
}

function agentRowHtml(agent) {
  const name = String(agent["AGName"] ?? "");
  const level = Number(agent["AGLevel"]) || 0;
  const workload = Math.min(100, Math.max(0, Math.round((level / 15) * 100)));
  const active = isActiveValue(agent["IsActive"]);
  const letter = name.trim().charAt(0).toUpperCase() || "?";

  return `<tr class="agent-row hover:bg-white/[0.03] transition-colors" data-agent-id="${escapeHtml(
    agent["AGID"],
  )}">
    <td class="px-6 py-4">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 border border-[#feff7c]/40 bg-[#feff7c]/10 text-[#feff7c] flex items-center justify-center text-xs shrink-0">${escapeHtml(
          letter,
        )}</div>
        <div>
          <p class="agent-name text-sm">${escapeHtml(name)}</p>
          <p class="text-[11px] text-white/40 agent-email mt-0.5">${escapeHtml(
            agent["AGEmail"],
          )}</p>
        </div>
      </div>
    </td>
    <td class="px-6 py-4 agent-workload">
      <div class="flex items-center gap-2">
        <div class="w-24 h-1.5 bg-white/10 overflow-hidden">
          <div class="workload-bar h-full bg-[#feff7c]" data-width="${workload}" style="width: 0%; transition: width ${BAR_MS}ms ease"></div>
        </div>
        <span class="text-xs text-white/40 whitespace-nowrap">${level} open</span>
      </div>
    </td>
    <td class="px-6 py-4">${statusPillHtml(active)}</td>
    <td class="px-6 py-4 text-right">${actionBtnHtml(active)}</td>
  </tr>`;
}

function renderAgents(list) {
  if (!list.length) {
    agentsTableBody.innerHTML = messageRowHtml("No agents found");
    return;
  }
  agentsTableBody.innerHTML = list.map(agentRowHtml).join("");
}

async function loadAgents({ focusId = null } = {}) {
  const token = ++loadToken;
  const firstLoad = !loadedOnce;

  if (firstLoad) {
    agentsTableBody.innerHTML = messageRowHtml("Loading...");
  }

  let result;
  try {
    [result] = await Promise.all([
      api("/api/agents/all", "GET"),
      firstLoad ? wait(MIN_LOADING_MS) : Promise.resolve(),
    ]);
  } catch {
    if (token !== loadToken) return;
    if (firstLoad) {
      agentsTableBody.innerHTML = messageRowHtml(
        "Could not reach the server",
        true,
      );
    }
    showToast("Could not reach the server", true);
    return;
  }

  if (token !== loadToken) return;

  if (!result.ok || result.json.success === false) {
    if (firstLoad) {
      agentsTableBody.innerHTML = messageRowHtml("Failed to load agents", true);
    }
    showToast("UNABLE TO FETCH AGENTS : SERVER ERROR ", true, 5000);
    return;
  }

  const list = Array.isArray(result.json.data) ? result.json.data : [];

  if (firstLoad) {
    fadeTable(false);
    await wait(FADE_MS);
    if (token !== loadToken) return;
  }

  const freshIds = loadedOnce
    ? list
        .map((agent) => String(agent["AGID"]))
        .filter((id) => !knownIds.has(id))
    : [];

  knownIds = new Set(list.map((agent) => String(agent["AGID"])));
  loadedOnce = true;

  renderAgents(list);
  fadeTable(true);
  animateBars();

  const toFade = new Set(freshIds);
  if (focusId !== null) toFade.add(String(focusId));
  toFade.forEach(fadeInRow);
}

addAgentBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const email = agentEmailBox.value.trim();
  const name = agentNameBox.value.trim();

  const emailOk = emailVerify(email);
  if (!emailOk.success) return showToast(emailOk.message, true);
  const nameOk = nameVerify(name);
  if (!nameOk.success) return showToast(nameOk.message, true);

  const originalHtml = addAgentBtn.innerHTML;
  addAgentBtn.disabled = true;
  addAgentBtn.textContent = "Adding...";

  try {
    const [result] = await Promise.all([
      api("/api/agents/add", "POST", { email, name }),
      wait(MIN_LOADING_MS),
    ]);

    const data = result.json;
    showToast(data.message, !data.success);

    if (data.success) {
      agentEmailBox.value = "";
      agentNameBox.value = "";
      await loadAgents();
    }
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    addAgentBtn.disabled = false;
    addAgentBtn.innerHTML = originalHtml;
  }
});

agentsTableBody.addEventListener("click", async function (e) {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;

  const row = btn.closest("tr");
  if (!row || !row.dataset.agentId) return;

  e.preventDefault();
  e.stopPropagation();

  const agid = row.dataset.agentId;
  const originalText = btn.textContent;
  let restore = true;

  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const [result] = await Promise.all([
      api("/api/agents/toggleStatus", "PUT", { agid }),
      wait(MIN_LOADING_MS),
    ]);

    const data = result.json;
    showToast(data.message, !data.success);

    if (data.success) {
      restore = false;
      await loadAgents({ focusId: agid });
    }
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    if (restore && btn.isConnected) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});

loadAgents();
