/**
 * js/page.test.js
 * LPの見た目・SEO・公開ファイルの完成度テスト（node --test）。
 * 直す前の index.html では失敗し、直した後に通ることを想定。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const indexPath = path.join(root, "index.html");

function readIndex() {
  return fs.readFileSync(indexPath, "utf8");
}

/** 表示テキスト: <script>…</script> と <!--…--> を除いてタグを剥がす */
function displayText(html) {
  const noScript = html.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  const noComment = noScript.replace(/<!--[\s\S]*?-->/g, "");
  const noStyle = noComment.replace(/<style[\s\S]*?<\/style\s*>/gi, "");
  const noTags = noStyle.replace(/<[^>]+>/g, "");
  return noTags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractJsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
    ),
  ].map((m) => m[1]);
  return blocks;
}

function extractSummaries(html) {
  return [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary\s*>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}

function pngSize(buf) {
  // PNG signature + IHDR
  assert.equal(buf.length > 24, true, "og.png が小さすぎます");
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
  assert.equal(buf[2], 0x4e);
  assert.equal(buf[3], 0x47);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test("表示テキストに開発者向け文言が含まれない", () => {
  const text = displayText(readIndex());
  for (const word of [
    "FORM_ENDPOINT",
    "config.js",
    "差し替え",
    "iframe",
    "Enter / Space",
  ]) {
    assert.doesNotMatch(
      text,
      new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `表示テキストに「${word}」が残っています`,
    );
  }
});

test("「デモ」という語が表示テキスト中で3回以下", () => {
  const text = displayText(readIndex());
  const count = (text.match(/デモ/g) || []).length;
  assert.ok(
    count <= 3,
    `「デモ」が ${count} 回見つかりました（3回以下にしてください）`,
  );
});

test("JSON-LD がすべて JSON.parse でき、FAQPage と表示FAQが一致する", () => {
  const html = readIndex();
  const blocks = extractJsonLd(html);
  assert.ok(blocks.length >= 2, "JSON-LD が2件以上必要です");
  const docs = blocks.map((b) => JSON.parse(b));
  const faq = docs.find((d) => d["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage の JSON-LD がありません");
  const jsonQuestions = (faq.mainEntity || []).map((q) => (q.name || "").trim());
  const summaries = extractSummaries(html);
  assert.deepEqual(
    [...jsonQuestions].sort(),
    [...summaries].sort(),
    "FAQPage の質問とページの <summary> が一致しません",
  );
});

test("robots.txt・sitemap.xml・llms.txt・og.png が存在し og.png は 1200x630", () => {
  for (const name of ["robots.txt", "sitemap.xml", "llms.txt", "og.png"]) {
    assert.equal(
      fs.existsSync(path.join(root, name)),
      true,
      `${name} がありません`,
    );
  }
  const buf = fs.readFileSync(path.join(root, "og.png"));
  const { width, height } = pngSize(buf);
  assert.equal(width, 1200, `og.png の幅が ${width} です`);
  assert.equal(height, 630, `og.png の高さが ${height} です`);
});

test("head に canonical・og:image・description がある", () => {
  const html = readIndex();
  const head = (html.match(/<head[\s\S]*?<\/head\s*>/i) || [""])[0];
  assert.match(head, /<link[^>]*rel=["']canonical["'][^>]*>/i);
  assert.match(
    head,
    /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/deskloom\.github\.io\/demo-lp-local-business\/["']/i,
    "canonical の URL が違います",
  );
  assert.match(head, /<meta[^>]*property=["']og:image["'][^>]*content=/i);
  assert.match(head, /<meta[^>]*name=["']description["'][^>]*content=/i);
});

test("「施術の流れ」「お客様の声」のセクションが存在する", () => {
  const html = readIndex();
  assert.match(html, /施術の流れ/, "「施術の流れ」がありません");
  assert.match(html, /お客様の声/, "「お客様の声」がありません");
  assert.match(html, /<section[^>]*>[\s\S]*?施術の流れ/i);
  assert.match(html, /<section[^>]*>[\s\S]*?お客様の声/i);
});

test("制作メモ（case.html）があり、LPからリンクされ、書いてある計測イベントが実装と一致する", () => {
  const casePath = path.join(root, "case.html");
  assert.equal(fs.existsSync(casePath), true, "case.html がありません");
  assert.match(readIndex(), /href=["']case\.html["']/, "LPから case.html へのリンクがありません");
  const caseHtml = fs.readFileSync(casePath, "utf8");
  const table = (caseHtml.match(/<table class="case-table"[\s\S]*?<\/table>/) || [""])[0];
  const documented = [...table.matchAll(/<th scope="row"><code>([a-z_]+)<\/code><\/th>/g)].map((m) => m[1]).sort();
  const js = ["main.js", "ui.js"].map((f) => fs.readFileSync(path.join(here, f), "utf8")).join("\n");
  const implemented = [...new Set([...js.matchAll(/(?:track\(|event:\s*)"([a-z_]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(documented, implemented, "制作メモのイベント一覧と実装がずれています");
});

/** 開始タグごとに、その要素の中身（入れ子を数えて終了タグまで）を取り出す */
function innerOf(html, startIndex, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = startIndex;
  let depth = 0;
  let m;
  let begin = -1;
  while ((m = re.exec(html))) {
    if (m[1] === "") {
      if (depth === 0) begin = re.lastIndex;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(begin, m.index);
    }
  }
  return "";
}

test("外部のフォント・画像・スクリプト・CSSを読み込まない", () => {
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  for (const name of ["index.html", "case.html"]) {
    const html = fs.readFileSync(path.join(root, name), "utf8");
    assert.doesNotMatch(html, /<(?:script|img|iframe|source|video|audio)\b[^>]*\ssrc=["'](?:https?:)?\/\//i, `${name} に外部の src があります`);
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    for (const link of links) {
      if (/rel=["']canonical["']/i.test(link)) continue;
      assert.doesNotMatch(link, /href=["'](?:https?:)?\/\//i, `${name} に外部の link があります: ${link}`);
    }
    assert.doesNotMatch(html, /url\(\s*["']?(?:https?:)?\/\//i, `${name} のインラインCSSに外部URLがあります`);
  }
  assert.doesNotMatch(css, /url\(\s*["']?(?:https?:)?\/\//i, "style.css に外部URLがあります");
  assert.doesNotMatch(css, /@import/i, "style.css に @import があります");
});

test("同梱の明朝フォントは woff2・100KB以下・ライセンス同梱で、見出しの文字をすべて含む", () => {
  const fontPath = path.join(root, "fonts/komorebi-mincho.woff2");
  const buf = fs.readFileSync(fontPath);
  assert.equal(buf.subarray(0, 4).toString("latin1"), "wOF2", "woff2 ではありません");
  assert.ok(buf.length <= 100 * 1024, `フォントが ${buf.length} バイトあります（100KB以下にしてください）`);
  assert.equal(fs.existsSync(path.join(root, "fonts/OFL.txt")), true, "fonts/OFL.txt がありません");
  const chars = new Set(fs.readFileSync(path.join(root, "fonts/subset-chars.txt"), "utf8"));
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert.match(css, /@font-face\s*{[^}]*komorebi-mincho\.woff2[^}]*font-display:\s*swap/i);
  for (const name of ["index.html", "case.html"]) {
    const html = fs.readFileSync(path.join(root, name), "utf8").replace(/<svg[\s\S]*?<\/svg>/gi, "");
    // 明朝で表示する要素: h1 / h2 と class に serif を含む要素
    const starts = [...html.matchAll(/<(h1|h2|[a-z0-9]+(?=[^>]*class=["'][^"']*\bserif\b))\b[^>]*>/gi)];
    assert.ok(starts.length > 5, `${name} に明朝の見出しが見つかりません`);
    for (const m of starts) {
      const text = displayText(innerOf(html, m.index, m[1]));
      const missing = [...new Set([...text].filter((c) => c.trim() && !chars.has(c)))];
      assert.deepEqual(missing, [], `${name} の「${text.trim().slice(0, 20)}」にフォントに無い文字があります（fonts/README.md の手順で作り直してください）`);
    }
  }
});

test("SVG・画像は、意味のあるものに代替テキスト、飾りは読み上げ対象外", () => {
  const html = readIndex();
  const svgs = [...html.matchAll(/<svg\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(svgs.length >= 8);
  for (const tag of svgs) {
    const ok = /aria-hidden=["']true["']/.test(tag) || (/role=["']img["']/.test(tag) && /aria-label=["'][^"']{8,}["']/.test(tag));
    assert.ok(ok, `代替テキストも aria-hidden も無いSVGがあります: ${tag}`);
  }
  for (const img of html.match(/<img\b[^>]*>/gi) || []) assert.match(img, /\balt=/, `alt の無い img: ${img}`);
});

test("受付時間の表が JSON-LD の営業日と一致する（木・日を休みとして表示）", () => {
  const html = readIndex();
  const docs = extractJsonLd(html).map((b) => JSON.parse(b));
  const biz = docs.find((d) => d["@type"] === "HealthAndBeautyBusiness");
  const days = biz.openingHoursSpecification.flatMap((s) => s.dayOfWeek);
  const table = (html.match(/<table class="hours">[\s\S]*?<\/table>/) || [""])[0];
  const heads = [...table.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]).slice(1);
  const cells = [...table.matchAll(/<td>[\s\S]*?<\/td>/g)].map((m) => /受付/.test(m[0]));
  const map = { 月: "Monday", 火: "Tuesday", 水: "Wednesday", 木: "Thursday", 金: "Friday", 土: "Saturday", "日・祝": "Sunday" };
  assert.equal(heads.length, 7);
  heads.forEach((h, i) => assert.equal(cells[i], days.includes(map[h]), `${h} の表示が JSON-LD と違います`));
  assert.match(html, /9:00〜19:00/);
  assert.equal(biz.openingHoursSpecification[0].opens, "09:00");
  assert.equal(biz.openingHoursSpecification[0].closes, "19:00");
});

test("医療広告ガイドラインで問題になる表現を使わない", () => {
  for (const name of ["index.html", "case.html", "llms.txt"]) {
    const raw = fs.readFileSync(path.join(root, name), "utf8");
    const text = name.endsWith(".html") ? displayText(raw) : raw;
    for (const word of ["治る", "治ります", "完治", "必ず改善", "必ず良く", "効果があります", "絶対", "No.1", "日本一", "診療", "治療"]) {
      assert.ok(!text.includes(word), `${name} に「${word}」があります`);
    }
  }
});

test("動きを減らす設定でアニメーションを止め、フォーカスが見える", () => {
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  const reduce = (css.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\n}/) || [""])[0];
  assert.match(reduce, /animation:\s*none\s*!important/);
  assert.match(reduce, /transition:\s*none\s*!important/);
  assert.match(css, /:focus-visible\s*{[^}]*outline:\s*2px solid/);
});
