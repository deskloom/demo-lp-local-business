/**
 * js/ui.js（classic script）
 * 見た目の演出だけを受け持つ。フォームの処理は js/main.js。
 * - スクロールで .reveal を表示する
 * - スクロールしたらヘッダーに影をつける
 * - スマホの固定予約ボタンを、予約フォームが見えている間は隠す
 */
(function ui() {
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    reveals.forEach((el) => {
      // 同じ並びのカードは少しずつ遅らせて表示する
      const siblings = el.parentElement ? el.parentElement.querySelectorAll(":scope > .reveal") : [];
      const index = Array.prototype.indexOf.call(siblings, el);
      if (index > 0) el.style.transitionDelay = `${Math.min(index, 3) * 90}ms`;
      io.observe(el);
    });
  }

  const header = document.getElementById("site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const sticky = document.getElementById("sticky-cta");
  const reserve = document.getElementById("reserve");
  if (sticky && reserve && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        sticky.classList.toggle("is-hidden", entry.isIntersecting);
      }
    }).observe(reserve);
  }
})();
