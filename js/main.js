/**
 * js/main.js（classic script）
 * フォームの表示制御（確認画面・送信・エラー表示）。検証ロジック自体は
 * js/validate.js（window.AppValidate）に分離している。
 */
(function main() {
  const { validateForm } = window.AppValidate;

const form = document.getElementById("reserve-form");
const statusEl = document.getElementById("form-status");
const confirmEl = document.getElementById("form-confirm");
const confirmList = document.getElementById("confirm-list");
const backButton = document.getElementById("confirm-back");
const sendButton = document.getElementById("confirm-send");

let pendingData = null;
let confirming = false;

function fieldInputs() {
  return [
    "field-name",
    "field-phone",
    "field-email",
    "field-date",
    "field-message",
  ]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

/** 確認中は入力欄を読み取り専用にする（確認画面と送信内容のずれ防止） */
function setInputsReadOnly(on) {
  for (const input of fieldInputs()) {
    if (on) {
      input.setAttribute("readonly", "");
      // date 入力は readonly だけではピッカーを開ける場合があるため、
      // 確認中は change/input でも検知して確認状態を破棄する（二重防御）。
      // disabled にしないのは、FormData から値が消えて読めなくなるのを避けるため。
      if (input.type === "date") {
        input.setAttribute("aria-readonly", "true");
      }
    } else {
      input.removeAttribute("readonly");
      input.removeAttribute("aria-readonly");
    }
  }
}

/** 確認状態を破棄する（入力が変わった・クリアされた場合） */
function discardConfirm(message) {
  if (!confirming && confirmEl.hidden && !pendingData) return;
  confirming = false;
  pendingData = null;
  confirmEl.hidden = true;
  setInputsReadOnly(false);
  if (typeof message === "string" && message) {
    statusEl.textContent = message;
  }
}

function getEndpoint() {
  if (window.APP_CONFIG && typeof window.APP_CONFIG.FORM_ENDPOINT === "string") {
    return window.APP_CONFIG.FORM_ENDPOINT.trim();
  }
  return "";
}

/** 各欄の下にエラーを表示する */
function showErrors(errors) {
  const map = {
    name: "error-name",
    phone: "error-phone",
    email: "error-email",
    contact: "error-contact",
    date: "error-date",
    message: "error-message",
  };
  for (const [key, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = errors[key] || "";
  }
  const invalidMap = {
    name: "field-name",
    phone: "field-phone",
    email: "field-email",
    date: "field-date",
    message: "field-message",
  };
  for (const [key, id] of Object.entries(invalidMap)) {
    const input = document.getElementById(id);
    if (!input) continue;
    const hasError =
      Boolean(errors[key]) || (key === "phone" || key === "email" ? Boolean(errors.contact) : false);
    input.setAttribute("aria-invalid", hasError ? "true" : "false");
  }
}

function readForm() {
  const fd = new FormData(form);
  return {
    name: (fd.get("name") ?? "").toString(),
    phone: (fd.get("phone") ?? "").toString(),
    email: (fd.get("email") ?? "").toString(),
    date: (fd.get("date") ?? "").toString(),
    message: (fd.get("message") ?? "").toString(),
  };
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderConfirm(data) {
  const rows = [
    ["お名前", data.name.trim()],
    ["電話番号", data.phone.trim() || "（未入力）"],
    ["メールアドレス", data.email.trim() || "（未入力）"],
    ["希望日", data.date.trim()],
    ["ご相談内容", data.message.trim()],
  ];
  confirmList.innerHTML = rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");
  confirmEl.hidden = false;
  confirmEl.scrollIntoView({ block: "start" });
}

/** 希望日の min を今日に設定 */
function setDateMin() {
  const dateInput = document.getElementById("field-date");
  if (!dateInput) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  dateInput.min = `${y}-${m}-${d}`;
}

setDateMin();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  const data = readForm();
  const { valid, errors } = validateForm(data);
  showErrors(errors);
  if (!valid) {
    statusEl.textContent = "入力に誤りがあります。各項目の下のメッセージをご確認ください。";
    discardConfirm("");
    statusEl.textContent = "入力に誤りがあります。各項目の下のメッセージをご確認ください。";
    const firstError = form.querySelector('[aria-invalid="true"]');
    if (firstError) firstError.focus();
    return;
  }
  pendingData = data;
  confirming = true;
  setInputsReadOnly(true);
  renderConfirm(data);
  statusEl.textContent = "入力内容をご確認ください。よろしければ「送信する」を押してください。";
});

// 確認画面を出したあとに入力が変わったら確認状態を破棄する
form.addEventListener("input", () => {
  if (confirming) {
    discardConfirm("入力が変更されたため確認状態を取り消しました。もう一度「確認する」を押してください。");
  }
});
form.addEventListener("change", () => {
  if (confirming) {
    discardConfirm("入力が変更されたため確認状態を取り消しました。もう一度「確認する」を押してください。");
  }
});

// フォームのクリアでも確認状態を破棄する
form.addEventListener("reset", () => {
  // reset 既定動作の後に後片付けする
  setTimeout(() => {
    discardConfirm("");
    setDateMin();
    showErrors({ name: "", phone: "", email: "", contact: "", date: "", message: "" });
    statusEl.textContent = "入力をクリアしました。";
  }, 0);
});

backButton.addEventListener("click", () => {
  discardConfirm("内容を修正して、もう一度「確認する」を押してください。");
});

sendButton.addEventListener("click", async () => {
  if (!pendingData || !confirming) return;
  // 送信直前にもう一度入力チェックする（確認時と現在値のずれ・日跨ぎを検出）
  const current = readForm();
  const { valid, errors } = validateForm(current);
  showErrors(errors);
  if (!valid) {
    discardConfirm("送信前の再チェックで誤りが見つかりました。各項目をご確認ください。");
    const firstError = form.querySelector('[aria-invalid="true"]');
    if (firstError) firstError.focus();
    return;
  }
  // 確認時から値が変わっていたら送らず破棄（input/change の取りこぼし対策）
  if (JSON.stringify(current) !== JSON.stringify(pendingData)) {
    discardConfirm("入力が変更されたため確認状態を取り消しました。もう一度「確認する」を押してください。");
    return;
  }
  pendingData = current;
  const endpoint = getEndpoint();
  // デモモード: 送信せず完了表示
  if (!endpoint) {
    statusEl.textContent =
      "送信が完了しました（デモモードのため実際には送信していません）。確認のご連絡を差し上げます。";
    confirming = false;
    pendingData = null;
    confirmEl.hidden = true;
    setInputsReadOnly(false);
    form.reset();
    setDateMin();
    showErrors({ name: "", phone: "", email: "", contact: "", date: "", message: "" });
    statusEl.scrollIntoView({ block: "center" });
    return;
  }
  sendButton.disabled = true;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    statusEl.textContent = "送信が完了しました。確認のご連絡を差し上げます。";
    confirming = false;
    pendingData = null;
    confirmEl.hidden = true;
    setInputsReadOnly(false);
    form.reset();
    setDateMin();
  } catch (err) {
    statusEl.textContent =
      "送信に失敗しました。時間をおいて再度お試しください。お急ぎの方はお電話でご連絡ください。";
  } finally {
    sendButton.disabled = false;
  }
  });
})();
