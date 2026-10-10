import { showToast } from "./toast.js";
import { emailVerify, nameVerify } from "./dataValidation.js";

const agentsTableBody = document.getElementById("agentsTableBody");
const agentNameBox = document.getElementById("agentName");
const agentEmailBox = document.getElementById("agentEmail");
const addAgentBtn = document.getElementById("addAgentBtn");

document.addEventListener("DOMContentLoaded", function () {
  showAllAgents();
});

async function showAllAgents() {
  const response = await fetch("http://127.0.0.1:6901/api/agents/all", {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const jsonRes = await response.json();

  if (!response.ok) {
    return showToast("UNABLE TO FETCH AGENTS : SERVER ERROR ", true, 5000);
  }

  const data = jsonRes.data;

  for (const i of data) {
    const workLoad = Math.round((i["AGLevel"] / 15) * 100);

    let tempSpan = "";
    let tempBtn = "";
    if (i["IsActive"]) {
      tempSpan = `
         <span
                        class="agent-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-[#6ee7a0]/30 bg-[#6ee7a0]/10 text-[#6ee7a0]"
                      >
                        <span class="w-1.5 h-1.5 bg-[#6ee7a0]"></span>
                        Active
                      </span>
        `;

      tempBtn = `
         <button
                        class="deactivateAgentBtn text-[11px] uppercase text-[#ff8a8a] hover:text-[#ff6b6b] underline underline-offset-4 cursor-pointer transition-colors"
                        data-agent-id="1"
                      >
                        Deactivate
                      </button>
        `;
    } else {
      tempSpan = `
         <span
                        class="agent-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-white/10 bg-white/5 text-white/40"
                      >
                        <span class="w-1.5 h-1.5 bg-white/30"></span>
                        Inactive
                      </span>
        `;
      tempBtn = `
        <button
                        class="reactivateAgentBtn text-[11px] uppercase text-[#feff7c] hover:text-[#ffff47] underline underline-offset-4 cursor-pointer transition-colors"
                        data-agent-id="3"
                      >
                        Reactivate
                      </button>
        `;
    }

    let tempTr = document.createElement("tr");
    tempTr.classList.add(
      "agent-row",
      "hover:bg-white/[0.03]",
      "transition-colors",
    );

    tempTr.dataset.agentId = i["AGID"];

    tempTr.innerHTML = `
    <tr
                    class="agent-row hover:bg-white/[0.03] transition-colors"
                    data-agent-id="1"
                  >
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 border border-[#feff7c]/40 bg-[#feff7c]/10 text-[#feff7c] flex items-center justify-center text-xs shrink-0"
                        >
                          ${i["AGName"].split("")[0]}
                        </div>
                        <div>
                          <p class="agent-name text-sm">${i["AGName"]}</p>
                          <p
                            class="text-[11px] text-white/40 agent-email mt-0.5"
                          >
                            ${i["AGEmail"]}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 agent-workload">
                      <div class="flex items-center gap-2">
                        <div class="w-24 h-1.5 bg-white/10 overflow-hidden">
                          <div
                            class="h-full bg-[#feff7c]"
                            style="width: ${workLoad}%"
                          ></div>
                        </div>
                        <span class="text-xs text-white/40 whitespace-nowrap"
                          >${i["AGLevel"]} open</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4">
                     ${tempSpan}
                    </td>
                    <td class="px-6 py-4 text-right">
                     ${tempBtn}
                    </td>
                  </tr>
    `;

    agentsTableBody.appendChild(tempTr);
  }
}

addAgentBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const email = agentEmailBox.value.trim();
  const name = agentNameBox.value.trim();

  const emailOk = emailVerify(email);
  if (!emailOk.success) return showToast(emailOk.message, true);
  const nameOk = nameVerify(name);
  if (!nameOk.success) return showToast(nameOk.message, true);

  const response = await fetch("http://localhost:6901/api/agents/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      email: email,
      name: name,
    }),
  });

  const data = await response.json();

  return showToast(data.message, !data.success);
});

agentsTableBody.addEventListener("click", async function (e) {
  if (e.target.tagName !== "BUTTON") {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const agid = e.target.closest("tr").dataset.agentId;

  const response = await fetch(
    "http://localhost:6901/api/agents/toggleStatus",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        agid: agid,
      }),
    },
  );

  const data = await response.json();

  showToast(data.message, !data.success);

  if (data.success) {
    agentsTableBody.innerHTML = "";
    showAllAgents();
  }
  return;
});
