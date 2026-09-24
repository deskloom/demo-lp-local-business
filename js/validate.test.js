/**
 * js/validate.test.js
 * node --test で実行するテスト（正常系・異常系あわせて20件以上）。
 * validate.js は classic/ESM 両対応の単一ソースのため、副作用 import して
 * globalThis.AppValidate 経由で取り出す。
 */
import test from "node:test";
import assert from "node:assert/strict";
import "./validate.js";

const {
  validateName,
  validateEmail,
  validatePhone,
  validateContact,
  validateDate,
  validateMessage,
  validateForm,
} = globalThis.AppValidate;

// ---- お名前 ----
test("名前: 正常系（通常の名前）", () => {
  assert.equal(validateName("山田 太郎"), "");
});

test("名前: 異常系（空文字）", () => {
  assert.match(validateName(""), /お名前を入力/);
});

test("名前: 異常系（空白のみ）", () => {
  assert.match(validateName("   "), /お名前を入力/);
});

test("名前: 異常系（51文字）", () => {
  assert.match(validateName("あ".repeat(51)), /50文字以内/);
});

// ---- メール ----
test("メール: 正常系", () => {
  assert.equal(validateEmail("taro@example.com"), "");
});

test("メール: 異常系（空）", () => {
  assert.match(validateEmail(""), /入力してください/);
});

test("メール: 異常系（@なし）", () => {
  assert.match(validateEmail("taroexample.com"), /形式が正しくありません/);
});

test("メール: 異常系（スペース混じり）", () => {
  assert.match(validateEmail("taro @example.com"), /形式が正しくありません/);
});

// ---- 電話 ----
test("電話: 正常系（ハイフンあり携帯）", () => {
  assert.equal(validatePhone("090-0000-0000"), "");
});

test("電話: 正常系（ハイフンなし固定）", () => {
  assert.equal(validatePhone("0300000000"), "");
});

test("電話: 異常系（空）", () => {
  assert.match(validatePhone(""), /入力してください/);
});

test("電話: 異常系（文字混じり）", () => {
  assert.match(validatePhone("090-abc-0000"), /数字・ハイフン/);
});

test("電話: 異常系（桁数不足）", () => {
  assert.match(validatePhone("03-0000"), /10〜15桁/);
});

// ---- 連絡先（電話またはメール） ----
test("連絡先: 正常系（電話のみ）", () => {
  const r = validateContact({ phone: "090-0000-0000", email: "" });
  assert.equal(r.contact, "");
  assert.equal(r.phone, "");
});

test("連絡先: 正常系（メールのみ）", () => {
  const r = validateContact({ phone: "", email: "taro@example.com" });
  assert.equal(r.contact, "");
  assert.equal(r.email, "");
});

test("連絡先: 異常系（両方空）", () => {
  const r = validateContact({ phone: "", email: "" });
  assert.match(r.contact, /どちらか/);
});

test("連絡先: 異常系（両方とも形式エラー）", () => {
  const r = validateContact({ phone: "abc", email: "not-an-email" });
  assert.match(r.phone, /数字・ハイフン/);
  assert.match(r.email, /形式が正しくありません/);
});

// ---- 希望日（ローカル暦日で比較。main.js の setDateMin と同じ基準） ----
const FIXED_NOW = new Date(2026, 8, 24, 12, 0, 0); // ローカル 2026-09-24 正午

test("希望日: 正常系（今日）", () => {
  assert.equal(validateDate("2026-09-24", FIXED_NOW), "");
});

test("希望日: 正常系（未来日）", () => {
  assert.equal(validateDate("2026-10-01", FIXED_NOW), "");
});

test("希望日: 異常系（空）", () => {
  assert.match(validateDate("", FIXED_NOW), /入力してください/);
});

test("希望日: 異常系（過去日）", () => {
  assert.match(validateDate("2026-09-23", FIXED_NOW), /今日以降/);
});

test("希望日: 異常系（存在しない日付 2026-02-30）", () => {
  assert.match(validateDate("2026-02-30", FIXED_NOW), /正しい日付/);
});

test("希望日: 異常系（形式違い）", () => {
  assert.match(validateDate("2026/10/01", FIXED_NOW), /正しい日付/);
});

test("希望日: 境界（ローカル0時台でも今日は有効）", () => {
  const justAfterMidnight = new Date(2026, 8, 24, 0, 5, 0); // ローカル 0:05
  assert.equal(validateDate("2026-09-24", justAfterMidnight), "");
});

test("希望日: 境界（ローカル0時台でも前日は無効）", () => {
  const justAfterMidnight = new Date(2026, 8, 24, 0, 5, 0); // ローカル 0:05
  assert.match(validateDate("2026-09-23", justAfterMidnight), /今日以降/);
});

test("希望日: 境界（ローカル23時台でも今日は有効）", () => {
  const beforeMidnight = new Date(2026, 8, 24, 23, 59, 0);
  assert.equal(validateDate("2026-09-24", beforeMidnight), "");
  assert.match(validateDate("2026-09-23", beforeMidnight), /今日以降/);
});

// ---- 内容 ----
test("内容: 正常系（10文字ちょうど）", () => {
  assert.equal(validateMessage("あ".repeat(10)), "");
});

test("内容: 異常系（空）", () => {
  assert.match(validateMessage(""), /入力してください/);
});

test("内容: 異常系（9文字で短い）", () => {
  assert.match(validateMessage("あ".repeat(9)), /10文字以上/);
});

test("内容: 異常系（2001文字で長い）", () => {
  assert.match(validateMessage("あ".repeat(2001)), /2000文字以内/);
});

// ---- 全体 ----
test("全体: 正常系（全部有効）", () => {
  const r = validateForm(
    {
      name: "山田 太郎",
      phone: "090-0000-0000",
      email: "",
      date: "2026-10-01",
      message: "肩こりがひどく、初めて相談させていただきます。",
    },
    FIXED_NOW,
  );
  assert.equal(r.valid, true);
});

test("全体: 異常系（複数エラー）", () => {
  const r = validateForm(
    { name: "", phone: "", email: "", date: "2026-09-01", message: "短" },
    FIXED_NOW,
  );
  assert.equal(r.valid, false);
  assert.match(r.errors.name, /お名前/);
  assert.match(r.errors.contact, /どちらか/);
  assert.match(r.errors.date, /今日以降/);
  assert.match(r.errors.message, /10文字以上/);
});
