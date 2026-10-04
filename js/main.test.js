/**
 * js/main.test.js
 * main.js の送信成功後メッセージのテスト。DOM は最小のスタブで代用し、
 * main.js を vm で実行する（ブラウザ実機の確認は別途README参照）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import "./validate.js";

const source = fs.readFileSync(new URL("./main.js", import.meta.url), "utf8");

function makeEl() {
  const listeners = {};
  const attrs = {};
  return {
    hidden: false,
    disabled: false,
    textContent: "",
    innerHTML: "",
    value: "",
    type: "text",
    listeners,
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    setAttribute(k, v) { attrs[k] = v; },
    removeAttribute(k) { delete attrs[k]; },
    scrollIntoView() {},
    focus() {},
    querySelector() { return null; },
    async fire(t) { for (const fn of listeners[t] || []) await fn({ preventDefault() {} }); },
  };
}

function setup(endpoint, fetchImpl) {
  const els = {};
  for (const id of [
    "reserve-form", "form-status", "form-confirm", "confirm-list", "confirm-back",
    "confirm-send", "field-name", "field-phone", "field-email", "field-date", "field-message",
  ]) els[id] = makeEl();
  const values = { name: "山田 太郎", phone: "", email: "a@example.com", date: "2999-01-01", message: "肩こりと腰痛について相談したいです" };
  els["reserve-form"].reset = () => { els["reserve-form"].fire("reset"); };
  const sandbox = {
    window: { AppValidate: globalThis.AppValidate, APP_CONFIG: { FORM_ENDPOINT: endpoint } },
    document: { getElementById: (id) => els[id] || null },
    FormData: class { get(k) { return values[k]; } },
    fetch: fetchImpl,
    setTimeout,
    JSON,
  };
  vm.runInNewContext(source, sandbox);
  return els;
}

const tick = () => new Promise((r) => setTimeout(r, 10));

async function submitAndSend(els) {
  await els["reserve-form"].fire("submit");
  assert.equal(els["form-confirm"].hidden, false);
  await els["confirm-send"].fire("click");
  await tick();
}

test("デモモード: 送信完了メッセージがreset後も残り、確認連絡の約束をしない", async () => {
  const els = setup("", async () => { throw new Error("呼ばれない"); });
  await submitAndSend(els);
  const msg = els["form-status"].textContent;
  assert.match(msg, /送信が完了しました/);
  assert.match(msg, /実際には送信していません/);
  assert.doesNotMatch(msg, /ご連絡を差し上げます/);
  assert.doesNotMatch(msg, /クリアしました/);
});

test("本番モード: 送信成功メッセージがreset後も残る", async () => {
  const els = setup("https://example.invalid/form", async () => ({ ok: true, status: 200 }));
  await submitAndSend(els);
  assert.match(els["form-status"].textContent, /送信が完了しました/);
  assert.doesNotMatch(els["form-status"].textContent, /クリアしました/);
});

test("通常のフォームクリアでは「入力をクリアしました。」が出る", async () => {
  const els = setup("", async () => ({ ok: true }));
  els["reserve-form"].reset();
  await tick();
  assert.equal(els["form-status"].textContent, "入力をクリアしました。");
});

test("送信成功後のクリアが次の手動クリアのメッセージを抑止しない", async () => {
  const els = setup("", async () => ({ ok: true }));
  await submitAndSend(els);
  els["reserve-form"].reset();
  await tick();
  assert.equal(els["form-status"].textContent, "入力をクリアしました。");
});
