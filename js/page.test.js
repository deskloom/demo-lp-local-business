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
