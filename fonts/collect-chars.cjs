// 明朝（Komorebi Mincho）で実際に描かれる文字を、ブラウザで表示して集める（制作時だけ使う。ページからは読み込まない）
// 使い方: node fonts/collect-chars.cjs index.html case.html > fonts/subset-chars.txt
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const set = new Set();
  for (const f of process.argv.slice(2)) {
    for (const w of [375, 1280]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      await p.goto('file://' + path.resolve(f));
      const t = await p.evaluate(() => {
        let s = '';
        for (const el of document.querySelectorAll('body *')) {
          const ff = getComputedStyle(el).fontFamily;
          if (ff.includes('Komorebi')) {
            for (const n of el.childNodes) if (n.nodeType === 3) s += n.textContent;
          }
          for (const ps of ['::before', '::after']) {
            const cs = getComputedStyle(el, ps);
            if (cs.fontFamily.includes('Komorebi') && cs.content && cs.content !== 'none' && cs.content !== 'normal') s += cs.content.replace(/^"|"$/g, '');
          }
        }
        return s;
      });
      for (const c of t) set.add(c);
      await p.close();
    }
  }
  await b.close();
  let base = '';
  for (let i = 0x20; i <= 0x7e; i++) base += String.fromCharCode(i);
  for (let i = 0x3041; i <= 0x3096; i++) base += String.fromCharCode(i);
  for (let i = 0x30a1; i <= 0x30fc; i++) base += String.fromCharCode(i);
  base += '、。・「」『』（）〜ー―…“”‘’！？：／　％＋＆';
  for (const c of base) set.add(c);
  set.delete('\n'); set.delete('\t');
  const chars = [...set].filter(c => c.trim() || c === ' ' || c === '　').sort().join('');
  process.stdout.write(chars);
})();
