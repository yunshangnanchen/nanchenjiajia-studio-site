/* ============================================================
   GitHub 页面入场动画（GSAP）
   状态栏滑入 → 头像浮现 → 名字/简介依次上浮 → 贡献表浮现
   → 项目区滚动进入视口时逐级浮现
   ============================================================ */
(function () {
  if (!window.gsap) return;

  const q = function (s) { return document.querySelector(s); };

  const navbar   = q('#navbar');
  const logo     = q('.logo img');
  const avatar   = q('.gh-avatar');
  const texts    = [q('.gh-name'), q('.gh-login'), q('.gh-bio'), q('.gh-link')].filter(Boolean);
  const wrap     = q('.gh-graph-wrap');
  const secTitle = q('.gh-sec-title');
  const repos    = gsap.utils.toArray('.gh-repo');

  // 尊重系统的「减少动态效果」：直接保持终态，不做入场动画
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- 初始态 ---------- */
  gsap.set(navbar, { yPercent: -100 });
  gsap.set(logo,   { autoAlpha: 0, scale: 0.92 });
  if (avatar) gsap.set(avatar, { y: 22, autoAlpha: 0, scale: 0.9 });
  if (texts.length) gsap.set(texts, { y: 18, autoAlpha: 0 });
  if (wrap) gsap.set(wrap, { y: 26, autoAlpha: 0, scale: 0.985 });
  if (secTitle) gsap.set(secTitle, { y: 22, autoAlpha: 0 });
  if (repos.length) gsap.set(repos, { y: 24, autoAlpha: 0 });

  /* ---------- 主时间轴：与转场黑幕淡出同时进行 ---------- */
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  window.__ghTL = tl;                 // 调试用：控制台可 __ghTL.progress(1) 直接看终态

  tl.to(navbar, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0.05);

  if (avatar) {
    tl.to(avatar, { y: 0, autoAlpha: 1, scale: 1, duration: 0.9 }, 0.22);
  }
  if (texts.length) {
    tl.to(texts, { y: 0, autoAlpha: 1, duration: 0.75, stagger: 0.09 }, 0.34);
  }
  if (wrap) {
    tl.to(wrap, { y: 0, autoAlpha: 1, scale: 1, duration: 1.0 }, 0.45);
  }
  if (logo) {
    tl.to(logo, { autoAlpha: 1, scale: 1, duration: 0.7 }, 0.8);
  }

  /* ---------- 下方项目：滚动进入视口时逐级浮现 ---------- */
  if (window.ScrollTrigger && (secTitle || repos.length)) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.timeline({
      scrollTrigger: { trigger: '.gh-repos-sec', start: 'top 84%' }
    })
      .to(secTitle, { y: 0, autoAlpha: 1, duration: 0.7 }, 0)
      // clearProps：清掉行内 transform，否则会盖住 CSS 的 :hover 位移
      .to(repos, {
        y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.1, clearProps: 'transform'
      }, 0.18);

  } else {
    // 没有 ScrollTrigger 就直接显示，别让内容卡在隐藏状态
    gsap.set([secTitle, repos].filter(Boolean), { y: 0, autoAlpha: 1 });
  }
})();
