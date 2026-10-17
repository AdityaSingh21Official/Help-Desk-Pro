import {
  checkTicketSubject,
  checkTicketDescription,
} from "./dataValidation.js";
import { showToast } from "./toast.js";

const API_BASE = "http://127.0.0.1:6901/api";

const SUBJECT_MAX = 100;
const DESC_MAX = 2000;
const MIN_LOADING_MS = 600;
const SUCCESS_HOLD_MS = 1800;
const BURST_COLORS = ["#4f86c6", "#d9973b", "#d4605a", "#6f6f6f", "#ffffff"];

const form = document.getElementById("newTicketForm");
const ticketSubjectBox = document.getElementById("ticketSubject");
const ticketDescriptionBox = document.getElementById("ticketDescription");
const prioritySelector = document.getElementById("prioritySelector");
const submitTicketBtn = document.getElementById("submitTicketBtn");

const IDLE_HTML = submitTicketBtn.innerHTML;
const LOADING_HTML = `<span class="ck-spinner"></span>Sending...`;
const SUCCESS_HTML = `<svg class="ck-check" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7"/></svg>Ticket sent`;

let submitting = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Restart a CSS animation on an element that already has the class
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// We handle validation ourselves, so the browser's native bubbles don't hide the shake
form.noValidate = true;

/* ---------- Page-load sequence ---------- */

function playEntrance() {
  if (reduced()) return;

  const targets = [
    document.querySelector("header"),
    document.querySelector("main > div"),
    ...form.children,
  ].filter(Boolean);

  targets.forEach((el, i) => {
    el.style.setProperty("--i", i);
    el.classList.add("ck-reveal");
    el.addEventListener("animationend", function done(e) {
      if (e.target !== el) return;
      el.classList.remove("ck-reveal");
      el.style.removeProperty("--i");
      el.removeEventListener("animationend", done);
    });
  });
}

/* ---------- Character counters ---------- */

function attachCounter(input, max) {
  const counter = document.createElement("p");
  counter.className = "ck-counter";
  input.insertAdjacentElement("afterend", counter);

  const render = () => {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.classList.toggle("is-warn", len > max * 0.9 && len <= max);
    counter.classList.toggle("is-over", len > max);
  };

  input.addEventListener("input", () => {
    render();
    retrigger(counter, "ck-bump");
    input.classList.remove("ck-invalid");
  });

  render();
  return render;
}

const renderSubjectCount = attachCounter(ticketSubjectBox, SUBJECT_MAX);
const renderDescCount = attachCounter(ticketDescriptionBox, DESC_MAX);

/* ---------- Priority pills ---------- */

prioritySelector.addEventListener("change", (e) => {
  if (e.target.name !== "priority") return;
  const pill = e.target.nextElementSibling;
  if (pill) retrigger(pill, "ck-pop");
});

/* ---------- Validation feedback ---------- */

function invalid(el, message) {
  if (el.matches("input, textarea")) {
    el.classList.add("ck-invalid");
    el.focus();
  }
  retrigger(el, "ck-shake");
  showToast(message, true);
}

/* ---------- Submit button states ---------- */

function setButton(state) {
  submitTicketBtn.innerHTML =
    state === "loading"
      ? LOADING_HTML
      : state === "success"
        ? SUCCESS_HTML
        : IDLE_HTML;
}

submitTicketBtn.addEventListener("click", (e) => {
  if (reduced() || submitTicketBtn.disabled) return;

  const rect = submitTicketBtn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  // Keyboard-triggered clicks report 0,0, so fall back to the center
  const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
  const y = e.clientY ? e.clientY - rect.top : rect.height / 2;

  const ripple = document.createElement("span");
  ripple.className = "ck-ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;
  submitTicketBtn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

/* ---------- Success burst ---------- */

function burst(originEl) {
  if (reduced()) return;

  const rect = originEl.getBoundingClientRect();
  const wrap = document.createElement("div");
  wrap.className = "ck-burst";
  wrap.style.left = `${rect.left + rect.width / 2}px`;
  wrap.style.top = `${rect.top + rect.height / 2}px`;

  const count = 18;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 70 + Math.random() * 90;
    const size = 5 + Math.random() * 5;
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.background = BURST_COLORS[i % BURST_COLORS.length];
    wrap.appendChild(dot);
  }

  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 900);
}

function resetForm() {
  ticketSubjectBox.value = "";
  ticketDescriptionBox.value = "";
  renderSubjectCount();
  renderDescCount();

  const medium = form.querySelector('input[name="priority"][value="medium"]');
  if (medium) {
    medium.checked = true;
    if (medium.nextElementSibling)
      retrigger(medium.nextElementSibling, "ck-pop");
  }

  if (document.activeElement instanceof HTMLElement)
    document.activeElement.blur();
}

/* ---------- Submit ---------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return;

  const ticketSubject = ticketSubjectBox.value.trim();
  const ticketDescription = ticketDescriptionBox.value.trim();
  const priority = document.querySelector(
    'input[name="priority"]:checked',
  )?.value;

  const subjectOk = checkTicketSubject(ticketSubject);
  if (!subjectOk.success) return invalid(ticketSubjectBox, subjectOk.message);

  const descOk = checkTicketDescription(ticketDescription);
  if (!descOk.success) return invalid(ticketDescriptionBox, descOk.message);

  if (!priority) return invalid(prioritySelector, "Please select a priority");

  submitting = true;
  submitTicketBtn.disabled = true;
  setButton("loading");

  let succeeded = false;

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/customer/newTicket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          sub: ticketSubject,
          desc: ticketDescription,
          priority,
          idempoKey: crypto.randomUUID(),
        }),
      }),
      wait(MIN_LOADING_MS),
    ]);

    const backendData = await response.json();

    if (backendData.success === false) {
      retrigger(submitTicketBtn, "ck-shake");
      showToast(backendData.message, true, 5000);
      return;
    }

    succeeded = true;
    setButton("success");
    burst(submitTicketBtn);
    retrigger(form, "ck-settle");
    resetForm();
    showToast(backendData.message);
    await wait(SUCCESS_HOLD_MS);
  } catch (err) {
    console.error("newTicket failed:", err);
    retrigger(submitTicketBtn, "ck-shake");
    showToast("Could not reach the server", true, 5000);
  } finally {
    setButton("idle");
    submitTicketBtn.disabled = false;
    submitting = false;
    if (!succeeded) submitTicketBtn.blur();
  }
});

playEntrance();
