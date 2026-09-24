/**
 * js/validate.js
 * DOM に依存しない入力チェック関数群（単一ソース）。
 *
 * - ブラウザでは通常の <script src="js/validate.js">（classic script）で読み込み、
 *   `window.AppValidate` 経由で利用する。file:// 直接開きでも動作するよう
 *   import/export 構文を使っていない。
 * - Node テストでは package.json の "type": "module" により ES モジュールとして
 *   副作用 import し、`globalThis.AppValidate` 経由で利用する。
 *   （`node --test js/validate.test.js` で実行）
 */
(function registerValidate() {
  /** 空でない文字列か */
  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  /** お名前: 必須・50文字以内 */
  function validateName(name) {
    if (!isNonEmptyString(name)) {
      return "お名前を入力してください。";
    }
    if (name.trim().length > 50) {
      return "お名前は50文字以内で入力してください。";
    }
    return "";
  }

  /** メール形式チェック（空文字は呼び出し側で必須判定する） */
  function validateEmail(email) {
    if (!isNonEmptyString(email)) {
      return "メールアドレスを入力してください。";
    }
    const v = email.trim();
    if (v.length > 254) {
      return "メールアドレスが長すぎます。";
    }
    // シンプルで実用的な形式チェック
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(v)) {
      return "メールアドレスの形式が正しくありません（例: taro@example.com）。";
    }
    return "";
  }

  /** 電話番号形式チェック（空文字は呼び出し側で必須判定する） */
  function validatePhone(phone) {
    if (!isNonEmptyString(phone)) {
      return "電話番号を入力してください。";
    }
    const v = phone.trim();
    // 数字・ハイフン・スペース・+・かっこのみ許可
    if (!/^[0-9+\-() ]+$/.test(v)) {
      return "電話番号は数字・ハイフン・スペース・+・かっこで入力してください（例: 090-0000-0000）。";
    }
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      return "電話番号は数字10〜15桁で入力してください（例: 090-0000-0000）。";
    }
    return "";
  }

  /**
   * 電話またはメールのどちらか必須チェック。
   */
  function validateContact({ phone = "", email = "" } = {}) {
    const phoneEmpty = !isNonEmptyString(phone);
    const emailEmpty = !isNonEmptyString(email);
    if (phoneEmpty && emailEmpty) {
      return {
        phone: "",
        email: "",
        contact: "電話番号かメールアドレスのどちらかを入力してください。",
      };
    }
    return {
      phone: phoneEmpty ? "" : validatePhone(phone),
      email: emailEmpty ? "" : validateEmail(email),
      contact: "",
    };
  }

  /** 日付文字列が有効なカレンダー日付か（YYYY-MM-DD）。
   * ローカル暦日として解釈し、存在しない日付（例: 2026-02-30）は null。
   * 戻り値はローカル0時00分の Date。
   */
  function parseDateOnly(dateStr) {
    if (typeof dateStr !== "string") return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    return dt;
  }

  /**
   * 今日の日付（ローカル暦日の0時00分）を得る。
   * main.js の setDateMin（getFullYear/getMonth/getDate）と同じ基準。
   * 引数で基準日を差し替え可能（テスト用）。
   */
  function todayLocal(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /** 旧名のエイリアス（後方互換。ローカル基準）。 */
  function todayUTC(now = new Date()) {
    return todayLocal(now);
  }

  /**
   * 希望日: 必須・YYYY-MM-DD・過去日不可（ローカル暦日で比較）
   * @param {string} dateStr
   * @param {Date} [now] 比較基準日（テスト用に注入可能）
   */
  function validateDate(dateStr, now = new Date()) {
    if (!isNonEmptyString(dateStr)) {
      return "希望日を入力してください。";
    }
    const dt = parseDateOnly(dateStr);
    if (!dt) {
      return "希望日はカレンダーから正しい日付を選んでください（例: 2026-10-01）。";
    }
    if (dt.getTime() < todayLocal(now).getTime()) {
      return "希望日は今日以降の日付を選んでください。";
    }
    return "";
  }

  /** ご相談内容: 必須・10〜2000文字 */
  function validateMessage(message) {
    if (!isNonEmptyString(message)) {
      return "ご相談内容を入力してください。";
    }
    const len = message.trim().length;
    if (len < 10) {
      return "ご相談内容は10文字以上で入力してください。";
    }
    if (len > 2000) {
      return "ご相談内容は2000文字以内で入力してください。";
    }
    return "";
  }

  /**
   * フォーム全体の検証。
   */
  function validateForm(data = {}, now = new Date()) {
    const name = validateName(data.name ?? "");
    const contact = validateContact({
      phone: data.phone ?? "",
      email: data.email ?? "",
    });
    const date = validateDate(data.date ?? "", now);
    const message = validateMessage(data.message ?? "");
    const errors = {
      name,
      phone: contact.phone,
      email: contact.email,
      contact: contact.contact,
      date,
      message,
    };
    const valid = Object.values(errors).every((e) => e === "");
    return { valid, errors };
  }

  globalThis.AppValidate = {
    isNonEmptyString,
    validateName,
    validateEmail,
    validatePhone,
    validateContact,
    parseDateOnly,
    todayLocal,
    todayUTC,
    validateDate,
    validateMessage,
    validateForm,
  };
})();
