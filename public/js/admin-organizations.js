import { showToast } from "./toast.js";

const API_BASE = "http://127.0.0.1:6901";
const ENDPOINTS = {
  orgs: "/api/orgs-data",
  members: "/api/orgs-members",
  addOrg: "/api/add-orgs",
  removeOrg: "/api/remove-orgs",
  addMember: "/api/orgs/newMember",
  removeMember: "/api/orgs/remove-member",
};

const ORG_NAME_REGEX = /^[a-zA-Z0-9._\-\s]{2,100}$/;
const PERSON_NAME_REGEX = /^[a-zA-Z.'\-\s]{2,100}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FADE_MS = 150;
const MIN_LOADING_MS = 350;
const ROW_REMOVE_MS = 220;
const CONFIRM_CLOSE_DELAY_MS = 200;

const appRoot = document.getElementById("appRoot");
const orgList = document.getElementById("orgList");
const orgCount = document.getElementById("orgCount");
const selectedOrgName = document.getElementById("selectedOrgName");
const selectedOrgMeta = document.getElementById("selectedOrgMeta");
const removeOrgBtn = document.getElementById("removeOrgBtn");
const membersTableBody = document.getElementById("membersTableBody");
const memberCount = document.getElementById("memberCount");
const membersEmptyState = document.getElementById("membersEmptyState");
const membersEmptyTitle = document.getElementById("membersEmptyTitle");
const membersEmptyText = document.getElementById("membersEmptyText");

const addOrgForm = document.getElementById("addOrgForm");
const orgNameInput = document.getElementById("orgName");
const addOrgBtn = document.getElementById("addOrgBtn");

const addMemberForm = document.getElementById("addMemberForm");
const memberNameInput = document.getElementById("memberName");
const memberEmailInput = document.getElementById("memberEmail");
const addMemberBtn = document.getElementById("addMemberBtn");

const confirmModal = document.getElementById("confirmModal");
const confirmPanel = document.getElementById("confirmModalPanel");
const confirmBackdrop = document.getElementById("confirmModalBackdrop");
const confirmCloseBtn = document.getElementById("confirmModalClose");
const confirmTitleMain = document.getElementById("confirmTitleMain");
const confirmTitleAccent = document.getElementById("confirmTitleAccent");
const confirmOwner = document.getElementById("confirmModalOwner");
const confirmNotice = document.getElementById("confirmNoticeText");
const confirmYesBtn = document.getElementById("confirmModalYesBtn");
const confirmNoBtn = document.getElementById("confirmModalNoBtn");

let orgs = [];
let members = [];
let selectedOrgId = null;
let membersLoading = false;
let memberToken = 0;
let orgsLoadedOnce = false;

let pendingAction = null;
let confirmBusy = false;
let confirmLastFocused = null;
let confirmCloseTimer = null;

// ---------- smoothness helpers ----------

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The members panel = the table wrapper + the empty-state block
const membersPanel = membersTableBody.closest(".overflow-x-auto");
const fadeTargets = [membersPanel, membersEmptyState].filter(Boolean);

fadeTargets.forEach((el) => {
  el.style.transition = `opacity ${FADE_MS}ms ease`;
});
orgList.style.transition = `opacity ${FADE_MS}ms ease`;

function fadeMembers(visible) {
  fadeTargets.forEach((el) => {
    el.style.opacity = visible ? "1" : "0";
  });
}

function fadeInOrgList() {
  orgList.style.opacity = "0";
  setTimeout(() => {
    orgList.style.opacity = "1";
  }, 20);
}

// ---------- api ----------

async function request(path, method, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  try {
    return await response.json();
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const second = parts[1] ? parts[1][0] : parts[0][1] || "";
  return (parts[0][0] + second).toUpperCase();
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function getOrg(orgId) {
  return orgs.find((o) => Number(o.orgId) === Number(orgId));
}

function listMessageHtml(text, isError = false) {
  const color = isError ? "text-[#ff8a8a]" : "text-white/40";
  return `<p class="px-5 py-8 text-center text-xs uppercase ${color}">${escapeHtml(
    text,
  )}</p>`;
}

function orgItemHtml(org) {
  const active = Number(org.orgId) === Number(selectedOrgId);
  const itemClasses = active
    ? "org-item active bg-[#feff7c]/10 border-[#feff7c]"
    : "org-item hover:bg-white/[0.03] border-transparent transition-colors";
  const avatarClasses = active
    ? "border-[#feff7c]/40 bg-[#feff7c]/10 text-[#feff7c]"
    : "border-white/10 bg-white/5 text-white/60";
  const count = Number(org.members) || 0;

  return `<button type="button" class="${itemClasses} w-full text-left flex items-center gap-3 px-5 py-4 border-l-2 cursor-pointer" data-org-id="${escapeHtml(
    org.orgId,
  )}">
    <span class="w-9 h-9 border ${avatarClasses} flex items-center justify-center text-xs shrink-0">${escapeHtml(
      initials(org.orgName),
    )}</span>
    <span class="flex-1 min-w-0">
      <span class="org-name block text-sm truncate">${escapeHtml(
        org.orgName,
      )}</span>
      <span class="org-members block text-[11px] text-white/40 mt-0.5">${plural(
        count,
        "member",
      )}</span>
    </span>
  </button>`;
}

function renderOrgList() {
  orgCount.textContent = `${orgs.length} total`;

  if (!orgs.length) {
    orgList.innerHTML = listMessageHtml("No organizations yet");
    return;
  }

  orgList.innerHTML = orgs.map(orgItemHtml).join("");
}

function renderHeader() {
  const org = getOrg(selectedOrgId);

  if (!org) {
    selectedOrgName.textContent = "No organization selected";
    selectedOrgMeta.textContent = "/ Pick one from the list";
    removeOrgBtn.classList.add("hidden");
    removeOrgBtn.dataset.orgId = "";
    return;
  }

  selectedOrgName.textContent = org.orgName;
  selectedOrgMeta.textContent = plural(Number(org.members) || 0, "member");
  removeOrgBtn.classList.remove("hidden");
  removeOrgBtn.dataset.orgId = String(org.orgId);
}

function showEmpty(title, text) {
  membersEmptyTitle.textContent = title;
  membersEmptyText.textContent = text;
  membersEmptyState.classList.remove("hidden");
}

function memberRowHtml(member) {
  return `<tr class="member-row hover:bg-white/[0.03] transition-colors" data-cid="${escapeHtml(
    member.cid,
  )}">
    <td class="px-6 py-4">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 border border-white/10 bg-white/5 text-white/60 flex items-center justify-center text-xs shrink-0">${escapeHtml(
          initials(member.cname),
        )}</div>
        <div class="min-w-0">
          <p class="member-name text-sm">${escapeHtml(member.cname)}</p>
          <p class="member-email text-[11px] text-white/40 mt-0.5">${escapeHtml(
            member.cemail,
          )}</p>
        </div>
      </div>
    </td>
    <td class="px-6 py-4 text-right">
      <button class="removeMemberBtn text-[11px] uppercase text-[#ff8a8a] hover:text-[#ff6b6b] underline underline-offset-4 cursor-pointer transition-colors" data-cid="${escapeHtml(
        member.cid,
      )}">Remove</button>
    </td>
  </tr>`;
}

// Renders the current state, then fades the panel back in
function renderMembers() {
  if (selectedOrgId === null) {
    membersTableBody.innerHTML = "";
    memberCount.textContent = "—";
    showEmpty(
      "No organization selected",
      "/ Click an organization on the left to view its members.",
    );
  } else if (membersLoading) {
    membersTableBody.innerHTML = "";
    memberCount.textContent = "—";
    showEmpty("Loading members...", "");
  } else {
    memberCount.textContent = plural(members.length, "person");
    membersTableBody.innerHTML = members.map(memberRowHtml).join("");

    if (!members.length) {
      showEmpty(
        "No members yet",
        "/ Add the first person using the form below.",
      );
    } else {
      membersEmptyState.classList.add("hidden");
    }
  }

  fadeMembers(true);
}

async function resetSelection() {
  selectedOrgId = null;
  members = [];
  membersLoading = false;
  memberToken++;
  renderOrgList();
  renderHeader();
  renderMembers();
}

async function loadOrgs() {
  // Only show "Loading..." on the very first load, so later refreshes
  // (after add / remove) don't make the list flash.
  if (!orgsLoadedOnce) {
    orgList.innerHTML = listMessageHtml("Loading...");
  }

  try {
    const [data] = await Promise.all([
      request(ENDPOINTS.orgs, "GET"),
      orgsLoadedOnce ? Promise.resolve() : wait(MIN_LOADING_MS),
    ]);

    if (!data.success) {
      orgList.innerHTML = listMessageHtml(
        data.message || "Failed to load organizations",
        true,
      );
      showToast(data.message || "Failed to load organizations", true);
      return;
    }

    orgs = Array.isArray(data.data) ? data.data : [];

    const firstLoad = !orgsLoadedOnce;
    orgsLoadedOnce = true;

    if (selectedOrgId !== null && !getOrg(selectedOrgId)) {
      await resetSelection();
      return;
    }

    renderOrgList();
    renderHeader();

    if (firstLoad) fadeInOrgList();
  } catch {
    orgList.innerHTML = listMessageHtml("Could not reach the server", true);
    showToast("Could not reach the server", true);
  }
}

// silent = true keeps the current rows on screen and refreshes in place
// (used after adding a member so the table doesn't blank out).
async function selectOrg(orgId, { silent = false } = {}) {
  selectedOrgId = Number(orgId);
  const token = ++memberToken;
  const org = getOrg(selectedOrgId);

  renderOrgList();
  renderHeader();

  if (!silent) {
    // fade the old content out before swapping
    fadeMembers(false);
    await wait(FADE_MS);
    if (token !== memberToken) return;
    members = [];
  }

  // Org has no members -> no request needed
  if (!org || (Number(org.members) || 0) === 0) {
    membersLoading = false;
    members = [];
    renderMembers();
    return;
  }

  if (!silent) {
    membersLoading = true;
    renderMembers();
  }

  try {
    const [data] = await Promise.all([
      request(ENDPOINTS.members, "PUT", { orgId: selectedOrgId }),
      silent ? Promise.resolve() : wait(MIN_LOADING_MS),
    ]);

    if (token !== memberToken) return;

    if (!silent) {
      // fade the loader out, then fade the result in
      fadeMembers(false);
      await wait(FADE_MS);
      if (token !== memberToken) return;
    }

    membersLoading = false;

    if (!data.success) {
      members = [];
      renderMembers();
      showToast(data.message || "Could not load members", true);
      return;
    }

    members = Array.isArray(data.data) ? data.data : [];
    renderMembers();
  } catch {
    if (token !== memberToken) return;
    membersLoading = false;
    members = [];
    renderMembers();
    showToast("Could not reach the server", true);
  }
}

// ---------- confirm modal ----------

function openConfirm(config, action) {
  clearTimeout(confirmCloseTimer);

  pendingAction = action;
  confirmLastFocused = document.activeElement;

  confirmTitleMain.textContent = config.titleMain;
  confirmTitleAccent.textContent = config.titleAccent;
  confirmOwner.textContent = config.owner ? `/ ${config.owner}` : "";
  confirmNotice.textContent = config.notice;
  confirmYesBtn.textContent = config.confirmLabel;
  confirmYesBtn.dataset.label = config.confirmLabel;

  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
  document.body.style.overflow = "hidden";

  confirmModal.classList.add("is-open");
  appRoot.classList.add("hd-blurred");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      confirmModal.classList.add("is-visible");
      confirmNoBtn.focus();
    });
  });
}

function closeConfirm() {
  if (!confirmModal.classList.contains("is-open") || confirmBusy) return;

  confirmModal.classList.remove("is-visible");
  appRoot.classList.remove("hd-blurred");

  confirmCloseTimer = setTimeout(() => {
    confirmModal.classList.remove("is-open");
    pendingAction = null;
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    if (confirmLastFocused && confirmLastFocused.focus) {
      confirmLastFocused.focus();
    }
  }, 230);
}

async function runConfirm() {
  if (!pendingAction || confirmBusy) return;

  confirmBusy = true;
  confirmYesBtn.disabled = true;
  confirmNoBtn.disabled = true;
  confirmYesBtn.textContent = "Removing...";

  try {
    await pendingAction();
  } finally {
    confirmBusy = false;
    confirmYesBtn.disabled = false;
    confirmNoBtn.disabled = false;
    confirmYesBtn.textContent = confirmYesBtn.dataset.label || "Yes, remove";

    // short pause so the modal doesn't vanish the instant the action ends
    await wait(CONFIRM_CLOSE_DELAY_MS);
    closeConfirm();
  }
}

// ---------- actions ----------

async function removeOrgAction(orgId) {
  try {
    const data = await request(ENDPOINTS.removeOrg, "DELETE", { orgId });

    if (!data.success) {
      let message = data.message || "Could not remove organization";
      if (data.data) {
        message += ` (${data.data.activeMembers} members, ${data.data.activeKeys} active keys)`;
      }
      showToast(message, true);
      return;
    }

    showToast(data.message || "Removed Successfully");

    if (Number(selectedOrgId) === Number(orgId)) {
      memberToken++;
      fadeMembers(false);
      await wait(FADE_MS);

      selectedOrgId = null;
      members = [];
      membersLoading = false;
      renderHeader();
      renderMembers();
    }

    await loadOrgs();
  } catch {
    showToast("Could not reach the server", true);
  }
}

async function removeMemberAction(orgId, cid) {
  try {
    const data = await request(ENDPOINTS.removeMember, "DELETE", {
      orgId,
      cid,
    });

    if (!data.success) {
      showToast(data.message || "Could not remove member", true);
      return;
    }

    showToast(data.message || "Org Member Removed");

    // fade the row out before taking it off the table
    const row = membersTableBody.querySelector(`tr[data-cid="${cid}"]`);
    if (row) {
      row.style.transition = `opacity ${ROW_REMOVE_MS}ms ease`;
      row.style.opacity = "0";
      await wait(ROW_REMOVE_MS);
    }

    const org = getOrg(orgId);
    if (org) org.members = Math.max(0, (Number(org.members) || 0) - 1);

    if (Number(selectedOrgId) === Number(orgId)) {
      members = members.filter((m) => Number(m.cid) !== Number(cid));
      renderMembers();
      renderHeader();
    }

    renderOrgList();
  } catch {
    showToast("Could not reach the server", true);
  }
}

// ---------- events ----------

orgList.addEventListener("click", (e) => {
  const item = e.target.closest(".org-item");
  if (!item) return;

  const orgId = Number(item.dataset.orgId);

  // clicking the already-selected org shouldn't refetch / flicker
  if (orgId === Number(selectedOrgId)) return;

  selectOrg(orgId);
});

removeOrgBtn.addEventListener("click", () => {
  const orgId = Number(removeOrgBtn.dataset.orgId);
  const org = getOrg(orgId);
  if (!org) return;

  openConfirm(
    {
      titleMain: "Remove",
      titleAccent: "organization?",
      owner: org.orgName,
      notice:
        "This permanently deletes the organization. It must have no members and no active keys.",
      confirmLabel: "Yes, remove organization",
    },
    () => removeOrgAction(orgId),
  );
});

membersTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".removeMemberBtn");
  if (!btn) return;

  const orgId = Number(selectedOrgId);
  const cid = Number(btn.dataset.cid);
  const member = members.find((m) => Number(m.cid) === cid);

  openConfirm(
    {
      titleMain: "Remove",
      titleAccent: "member?",
      owner: member ? `${member.cname} · ${member.cemail}` : "",
      notice:
        "This person will be deleted from the organization and will lose access.",
      confirmLabel: "Yes, remove member",
    },
    () => removeMemberAction(orgId, cid),
  );
});

addOrgForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const orgName = orgNameInput.value.trim();

  if (!ORG_NAME_REGEX.test(orgName)) {
    return showToast("Invalid Organization Name", true);
  }

  addOrgBtn.disabled = true;

  try {
    const data = await request(ENDPOINTS.addOrg, "POST", { orgName });

    if (!data.success) {
      showToast(data.message || "Could not add organization", true);
      return;
    }

    orgNameInput.value = "";
    showToast(data.message || "Organization Added");
    await loadOrgs();
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    addOrgBtn.disabled = false;
  }
});

addMemberForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (selectedOrgId === null) {
    return showToast("Select an organization first", true);
  }

  const name = memberNameInput.value.trim();
  const email = memberEmailInput.value.trim();

  if (!PERSON_NAME_REGEX.test(name)) {
    return showToast("Invalid Name", true);
  }

  if (!EMAIL_REGEX.test(email)) {
    return showToast("Invalid Email", true);
  }

  const orgId = Number(selectedOrgId);
  addMemberBtn.disabled = true;

  try {
    const data = await request(ENDPOINTS.addMember, "POST", {
      orgId,
      name,
      email,
    });

    if (!data.success) {
      showToast(data.message || "Could not add member", true);
      return;
    }

    memberNameInput.value = "";
    memberEmailInput.value = "";
    showToast(data.message || "New Org Member Added");

    const org = getOrg(orgId);
    if (org) org.members = (Number(org.members) || 0) + 1;

    if (Number(selectedOrgId) === orgId) {
      // silent refresh: keep rows visible, no loader flash
      await selectOrg(orgId, { silent: true });
    } else {
      renderOrgList();
    }
  } catch {
    showToast("Could not reach the server", true);
  } finally {
    addMemberBtn.disabled = false;
  }
});

confirmYesBtn.addEventListener("click", runConfirm);
confirmNoBtn.addEventListener("click", closeConfirm);
confirmCloseBtn.addEventListener("click", closeConfirm);
confirmBackdrop.addEventListener("click", closeConfirm);

confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) closeConfirm();
});

document.addEventListener("keydown", (e) => {
  if (!confirmModal.classList.contains("is-open")) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeConfirm();
    return;
  }

  if (e.key === "Tab") {
    const focusable = confirmPanel.querySelectorAll("button:not([disabled])");
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

renderHeader();
renderMembers();
loadOrgs();
