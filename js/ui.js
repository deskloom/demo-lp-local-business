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

  // ---- 計測（GTM を入れればそのまま GA4 のイベントになる形で dataLayer に積む） ----
  const dataLayer = (window.dataLayer = window.dataLayer || []);

  // URL に ?track=1 を付けると、積まれたイベントを画面右下に表示する（確認用）
  if (/[?&]track=1\b/.test(window.location.search)) {
    const panel = document.createElement("aside");
    panel.className = "track-panel";
    panel.setAttribute("aria-label", "計測イベントの表示");
    panel.innerHTML =
      '<p class="track-title">計測イベント<span>GA4 / GTM に送る内容</span></p><ol class="track-list"></ol>';
    document.body.appendChild(panel);
    const list = panel.querySelector(".track-list");
    const show = (item) => {
      const li = document.createElement("li");
      const params = Object.keys(item)
        .filter((k) => k !== "event")
        .map((k) => `${k}=${item[k]}`)
        .join(" ");
      const time = new Date().toTimeString().slice(0, 8);
      li.innerHTML = `<time>${time}</time><b></b><span></span>`;
      li.querySelector("b").textContent = item.event;
      li.querySelector("span").textContent = params;
      list.prepend(li);
      while (list.children.length > 8) list.lastElementChild.remove();
    };
    dataLayer.forEach(show);
    const push = dataLayer.push.bind(dataLayer);
    dataLayer.push = (...items) => {
      items.forEach(show);
      return push(...items);
    };
  }

  // 予約・電話ボタンのクリック（どこのボタンか・Webか電話か）
  document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest("[data-cta]") : null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    dataLayer.push({
      event: "cta_click",
      cta_location: a.getAttribute("data-cta"),
      cta_type: href.startsWith("tel:") ? "tel" : "web",
    });
  });

  // どのセクションまで読まれたか（各セクション1回だけ）。
  // ボタンで一気にスクロールして通り過ぎただけのものは数えないよう、0.8秒留まったら記録する。
  if ("IntersectionObserver" in window) {
    const timers = new Map();
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          if (!entry.isIntersecting) {
            clearTimeout(timers.get(el));
            timers.delete(el);
            continue;
          }
          if (timers.has(el)) continue;
          timers.set(
            el,
            setTimeout(() => {
              dataLayer.push({ event: "section_view", section: el.id });
              seen.unobserve(el);
              timers.delete(el);
            }, 800),
          );
        }
      },
      { rootMargin: "0px 0px -50% 0px", threshold: 0 },
    );
    document.querySelectorAll("main section[id]").forEach((s) => seen.observe(s));
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
