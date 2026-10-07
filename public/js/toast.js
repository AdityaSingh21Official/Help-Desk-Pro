const notification = document.getElementById("toast");
let hideTimer;

const SUCCESS_CLASSES = ["bg-[#feff7c]", "text-[#434302]"];
const ERROR_CLASSES = ["bg-[#ff6b6b]", "text-[#080809]"];

function showToast(message, isError = false, time = 3000) {
  if (!notification) return;

  notification.textContent = message;

  notification.classList.remove(...SUCCESS_CLASSES, ...ERROR_CLASSES);
  notification.classList.add(...(isError ? ERROR_CLASSES : SUCCESS_CLASSES));

  notification.classList.remove("-top-28");
  notification.classList.add("top-5");

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    notification.classList.remove("top-5");
    notification.classList.add("-top-28");
  }, time);
}

export { showToast };
