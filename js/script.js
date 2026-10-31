/* ============================================================
   GSAP（本地 vendor，离线可用）
   ============================================================ */
const HAS_GSAP = typeof window.gsap !== 'undefined';
if (HAS_GSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   开场动画：黑底 + 漂浮粒子 + 两行文字各自上滑 → 停留 2s → 原方向滑回
   ============================================================ */
(function () {
  const intro   = document.getElementById('intro');
  if (!intro) return;

  const root    = document.documentElement;
  const line1   = document.querySelector('.intro-line-1');
  const line2   = document.querySelector('.intro-line-2');
  const mask1   = document.querySelector('.intro-mask-1');
  const mask2   = document.querySelector('.intro-mask-2');

  const heroImg = document.getElementById('heroImg');
  const navbar  = document.getElementById('navbar');
  // 入场动画作用于 <img>：这样 <a> 上不会留下 inline transform，
  // CSS 的 :hover 位移 / 缩放才能正常生效
  const logo    = document.querySelector('.logo img');
  const caption = document.querySelector('.hero-caption');
  const hint    = document.getElementById('scrollHint');

  /* ============================================================
     欢迎动画只在“进入站点”时放一次（同一次浏览会话内不再重复）
     从 GitHub 页点 HOME 回来时走轻量入场，不再重复欢迎语
     ============================================================ */
  const PLAYED_KEY = 'ncj:introPlayed';
  function introPlayed() {
    try { return sessionStorage.getItem(PLAYED_KEY) === '1'; } catch (e) { return false; }
  }

  if (introPlayed()) {
    // 黑幕 / 文字层直接撤掉，换一套短入场，页面不会卡在锁滚动状态
    if (intro.parentNode) intro.remove();

    if (HAS_GSAP) {
      // is-entering 期间，滚动接管逻辑不碰这几个元素的 opacity（否则会跟动画抢）
      root.classList.add('is-entering');
      gsap.set(heroImg, { scale: 1.07, autoAlpha: 0.4 });
      gsap.set(navbar,  { yPercent: -100 });
      gsap.set(logo,    { autoAlpha: 0, scale: 0.96 });
      gsap.set(caption, { y: 16, autoAlpha: 0 });
      gsap.set(hint,    { autoAlpha: 0 });

      gsap.timeline({
        defaults: { ease: 'power2.out' },
        onComplete: function () {
          root.classList.remove('is-entering');
          if (window.ScrollTrigger) ScrollTrigger.refresh();
          window.dispatchEvent(new Event('scroll'));
        }
      })
        .to(heroImg, { scale: 1, autoAlpha: 1, duration: 1.2, ease: 'expo.out' }, 0.1)
        .to(navbar,  { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0.15)
        .to(caption, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.55)
        .to(logo,    { autoAlpha: 1, scale: 1, duration: 0.7 }, 0.6)
        .to(hint,    { autoAlpha: 1, duration: 0.6 }, 0.8);
    }
    return;
  }

  try { sessionStorage.setItem(PLAYED_KEY, '1'); } catch (e) {}

  root.classList.add('is-intro');                 // 锁滚动
  if ('scrollBehavior' in root.style) root.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);

  /* ---------- 宽屏：按“文字宽度不超过页面横向的 ~55%”自动测算字号 ---------- */
  // 宽屏判定：宽高比 ≥ 1.2（竖屏 / 方屏保持 CSS 默认，暂不处理）
  const MAX_TEXT_RATIO = 0.55;   // 文字最宽一行占视口宽度的上限（“一半多一点”）
  const NAME_UP        = 1.18;   // 名字比上行文字大一点
  const MASK_RATIO     = 0.82;   // 遮罩高度 = 字号 × 0.82 → 底部约 1/6 被遮

  function measure(el, size) {
    const old = el.style.fontSize;
    el.style.fontSize = size + 'px';
    el.style.width = 'max-content';
    const w = el.getBoundingClientRect().width;
    el.style.width = '';
    el.style.fontSize = old;
    return w || 1;
  }

  function fitText() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw / vh >= 1.2) {
      const maxW = vw * MAX_TEXT_RATIO;
      const w1 = measure(line1, 100);      // 上行在 100px 下的宽度
      const w2 = measure(line2, 100);      // 名字在 100px 下的宽度

      let s1 = 100 * maxW / w1;            // 上行：正好铺到 ~55% 宽
      let s2 = s1 * NAME_UP;               // 名字：略大于上行
      if (s2 * w2 / 100 > maxW) s2 = 100 * maxW / w2;   // 名字也不许超宽

      // 整块高度不超过视口 30%（避免超宽屏上过高）
      const gap = vh * 0.028;
      const h = s1 * MASK_RATIO + gap + s2 * MASK_RATIO;
      const maxH = vh * 0.30;
      if (h > maxH) {
        const k = maxH / h;
        s1 *= k;
        s2 *= k;
      }

      line1.style.fontSize = s1.toFixed(2) + 'px';
      line2.style.fontSize = s2.toFixed(2) + 'px';
    } else {
      line1.style.fontSize = '';
      line2.style.fontSize = '';
    }

    // 遮罩高度跟着最终字号走（宽屏 / 竖屏都适用）
    const fs1 = parseFloat(getComputedStyle(line1).fontSize) || 0;
    const fs2 = parseFloat(getComputedStyle(line2).fontSize) || 0;
    mask1.style.height = (fs1 * MASK_RATIO).toFixed(2) + 'px';
    mask2.style.height = (fs2 * MASK_RATIO).toFixed(2) + 'px';
  }

  fitText();
  window.addEventListener('resize', fitText);

  /* ---------- 全屏随机漂浮粒子 ---------- */
  const cvs = document.getElementById('introParticles');
  let raf = null;
  if (cvs && cvs.getContext) {
    const ctx = cvs.getContext('2d');
    let W = 0, H = 0, dpr = 1, dots = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cvs.width  = Math.floor(window.innerWidth  * dpr);
      H = cvs.height = Math.floor(window.innerHeight * dpr);
    }

    function seed() {
      const n = Math.max(40, Math.min(110, Math.round(W * H / (26000 * dpr))));
      dots = [];
      for (let i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (Math.random() * 1.5 + 0.4) * dpr,
          vx: (Math.random() - 0.5) * 0.16 * dpr,
          vy: -(Math.random() * 0.28 + 0.06) * dpr,
          a: Math.random() * 0.45 + 0.12,
          pa: Math.random() * Math.PI * 2,
          ps: Math.random() * 0.012 + 0.004
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < dots.length; i++) {
        const p = dots[i];
        p.x += p.vx;
        p.y += p.vy;
        p.pa += p.ps;
        if (p.y < -12 * dpr) { p.y = H + 12 * dpr; p.x = Math.random() * W; }
        if (p.x < -12 * dpr) p.x = W + 12 * dpr;
        if (p.x >  W + 12 * dpr) p.x = -12 * dpr;
        ctx.globalAlpha = Math.max(0.05, p.a + Math.sin(p.pa) * 0.18);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    resize();
    seed();
    tick();
    window.addEventListener('resize', function () { resize(); seed(); });
  }

  /* ---------- 无 GSAP 时的兜底（正常不会走到） ---------- */
  if (!HAS_GSAP) {
    [mask1, mask2].forEach(function (m) { m.style.clipPath = 'inset(0 0 0 0)'; });
    [line1, line2].forEach(function (l) { l.style.transform = 'translateY(0)'; });
    setTimeout(endIntro, 2200);
    return;
  }

  /* ============================================================
     GSAP 主时间轴
       0.00s  口子张开 + 两行文字错开上滑（各自动画）
       ~1.62s 完全出现 → 停留 2s
       → 原方向（向下）滑回消失
       → 黑幕淡出，主图 scale + opacity 出现
       → 顶部状态栏滑出 → 其他元素淡入
     ============================================================ */
  // 初始态（y:0 用于清掉 CSS 里 translateY(115%) 被解析成的像素位移）
  gsap.set([mask1, mask2], { clipPath: 'inset(50% 0% 50% 0%)' });
  gsap.set([line1, line2], { y: 0, yPercent: 115 });
  gsap.set(heroImg, { scale: 1.14, autoAlpha: 0 });
  gsap.set(navbar,  { yPercent: -100 });
  gsap.set(logo,    { autoAlpha: 0, scale: 0.92 });
  gsap.set(caption, { y: 26, autoAlpha: 0 });
  gsap.set(hint,    { autoAlpha: 0 });

  let finished = false;
  function unlock() {
    if (finished) return;
    finished = true;
    root.classList.remove('is-intro');
    root.style.scrollBehavior = '';
    // 锁滚动期间文档高度只有 100vh，ScrollTrigger 量到的位置是错的，解锁后重新量一次
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    // 让滚动逻辑立刻接管（比如刷新后浏览器恢复到页面中部的情况）
    window.dispatchEvent(new Event('scroll'));
  }
  function endIntro() {
    if (raf) cancelAnimationFrame(raf);
    if (intro && intro.parentNode) intro.remove();
  }

  const IN_L2 = 1.0, DUR_L2 = 1.4, HOLD = 1.0;  // 上滑各比原来慢 0.2s，停留 1 秒后开始滑回
  const OUT = IN_L2 + DUR_L2 + HOLD;            // 文字开始滑回的时刻

  const tl = gsap.timeline();

  // 出现：两行各自一套（口子 + 上滑），节奏错开
  tl.to(mask1,  { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: 'expo.out' }, 0.05)
    .to(line1,  { yPercent: 0, duration: 1.2, ease: 'expo.out' }, 0.15)
    .to(mask2,  { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.05, ease: 'expo.out' }, 0.30)
    .to(line2,  { yPercent: 0, duration: DUR_L2, ease: 'expo.out' }, IN_L2)
    .addLabel('out', OUT);

  // 消失：原方向（向下）滑回，口子合上
  tl.to(line2, { yPercent: 115, duration: 0.85, ease: 'power3.in' }, 'out')
    .to(line1, { yPercent: 115, duration: 0.85, ease: 'power3.in' }, 'out+=0.1')
    .to([mask1, mask2], { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.6, ease: 'power2.inOut' }, 'out+=0.45')
    .set(intro, { pointerEvents: 'none' }, 'out+=0.7')
    .to(intro,  { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 'out+=0.7')
    .call(unlock, null, 'out+=0.7')

  // 主图：缩放 + 不透明度出现
    .to(heroImg, { scale: 1, autoAlpha: 1, duration: 1.6, ease: 'expo.out' }, 'out+=1.0')
  // 顶部状态栏滑出 + 居中 logo 轻轻浮现
    .to(navbar,  { yPercent: 0, duration: 1.0, ease: 'expo.out' }, 'out+=1.35')
    .to(logo,    { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 'out+=1.75')
  // 其他元素
    .to(caption, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power2.out' }, 'out+=1.7')
    .to(hint,    { autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 'out+=1.9')
    .call(endIntro, null, 'out+=2.0');

  window.__introTL = tl;          // 调试用：可在控制台暂停 / 跳转时间轴

  // 跳过：直接跳到“开始滑回”，后面的入场动画照常播放
  let skipped = false;
  function skip() {
    if (skipped) return;
    skipped = true;
    if (tl.time() < OUT) tl.seek('out');
  }
  intro.addEventListener('click', skip);
  window.addEventListener('wheel', skip, { once: true, passive: true });
  window.addEventListener('touchstart', skip, { once: true, passive: true });
  window.addEventListener('keydown', skip, { once: true });
})();

/* ============================================================
   下滑时：可视区（hero-frame）上下收窄（宽度恒 100%）；
   图片铺满可视区并居中裁切 → 图片中间那一条始终留在可视区中央
   ============================================================ */
(function () {
  const frame   = document.getElementById('heroFrame');
  const edge    = document.getElementById('cropEdge');
  const hint    = document.getElementById('scrollHint');
  const caption = document.querySelector('.hero-caption');
  const sticky  = document.querySelector('.hero-sticky');
  const root    = document.documentElement;

  const KEEP = 0;   // 可视区最终保留高度（vh）

  let ticking = false;

  function update() {
    const raw = Math.min(Math.max(-sticky.getBoundingClientRect().top / window.innerHeight, 0), 1);
    const eased = raw * raw * (3 - 2 * raw);   // smoothstep

    frame.style.height = (100 - (100 - KEEP) * eased) + 'vh';

    // 开场 / 轻量入场动画期间不参与（交给 GSAP 控制），结束后才接管
    if (!root.classList.contains('is-intro') && !root.classList.contains('is-entering')) {
      edge.style.opacity    = raw > 0.04 ? '1' : '0';
      hint.style.opacity    = raw > 0.05 ? '0' : '1';
      caption.style.opacity = raw > 0.3  ? '0' : '1';
    }

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
})();

/* ============================================================
   下方内容：滚动进入视口时浮现；
   「关于我」代码块用打字机逐字呈现（保留 C 语法色）+ 打字音
   ============================================================ */
(function () {
  if (!HAS_GSAP || !window.ScrollTrigger) return;   // 无 GSAP：HTML 原样显示，不动

  const doc       = document;
  const avatar    = doc.querySelector('.about-avatar');
  const codeBlock = doc.querySelector('.code-block');
  const codeBodyEl = doc.getElementById('codeBody');
  let currentLines = [];          // 当前渲染成员的行数据（打字机消费）

  /* ---------- 工具：语法着色（逐字打字时也保留颜色） ---------- */
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* C 代码着色（// 注释、字符串、预处理、关键字、函数名）
     用占位符保护已着色的 token，避免注释/关键字正则误匹配 span 标签 */
  function highlightC(raw) {
    if (!raw) return '';
    let s = escapeHtml(raw);
    const store = [];

    function stash(match, cls) {
      const key = '\u0001A' + store.length + '\u0001';
      store.push('<span class="' + cls + '">' + match + '</span>');
      return key;
    }

    // 1) 字符串（先着色，这样字符串里的 // 不会被子注释误匹配）
    s = s.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { return stash(m, 'tk-str'); });
    // 2) // 行注释（含行首缩进，到行尾）
    s = s.replace(/^(\s*)(\/\/[^\n]*)$/gm, function (_, ind, body) {
      return ind + stash(body, 'tk-cmt');
    });
    // 3) 预处理 #include
    s = s.replace(/#include/g, function (m) { return stash(m, 'tk-pre'); });
    // 4) 关键字
    s = s.replace(/\b(int|return)\b/g, function (m) { return stash(m, 'tk-kw'); });
    // 5) 函数名
    s = s.replace(/\b(main|printf)\b/g, function (m) { return stash(m, 'tk-fn'); });

    // 还原占位符
    store.forEach(function (html, i) {
      s = s.replace('\u0001A' + i + '\u0001', html);
    });
    return s;
  }
  /* Python 代码着色（# 注释、关键字、函数名、字符串、数字）
     用占位符保护已着色的 token，避免后续正则误匹配 span 标签里的 class="..." 等属性 */
  function highlightPy(raw) {
    if (!raw) return '';
    let s = escapeHtml(raw);
    const store = [];

    function stash(match, cls) {
      // 占位符用 \u0001 A<n> \u0001：字母 A 让后面的数字不再单独成词，
      // 避免被数字正则 \b\d+\b 误匹配，也避开关键字/字符串正则。
      const key = '\u0001A' + store.length + '\u0001';
      store.push('<span class="' + cls + '">' + match + '</span>');
      return key;
    }

    // 1) 整行 # 注释（含行首缩进）
    s = s.replace(/^(\s*)#([^\n]*)$/gm, function (_, ind, body) {
      return ind + stash('#' + body, 'tk-cmt');
    });
    // 2) 字符串（双引号、单引号）
    s = s.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { return stash(m, 'tk-str'); });
    s = s.replace(/'(?:[^'\\]|\\.)*'/g, function (m) { return stash(m, 'tk-str'); });
    // 3) 数字
    s = s.replace(/\b(\d+)\b/g, function (m) { return stash(m, 'tk-num'); });
    // 4) 异常/内置类名
    s = s.replace(/\b(SystemExit|Exception|ValueError|TypeError|RuntimeError)\b/g,
      function (m) { return stash(m, 'tk-cls'); });
    // 5) 关键字
    s = s.replace(/\b(def|return|if|else|elif|import|from|raise|as|for|while|in|and|or|not|class|None|True|False|with|lambda|pass|try|except|finally)\b/g,
      function (m) { return stash(m, 'tk-kw'); });
    // 6) 函数名（名后跟左括号）
    s = s.replace(/\b([a-zA-Z_]\w*)(?=\()/g, function (m) { return stash(m, 'tk-fn'); });
    // 7) 类型注解箭头
    s = s.replace(/->/g, function (m) { return stash('-&gt;', 'tk-op'); });

    // 还原占位符
    store.forEach(function (html, i) {
      s = s.replace('\u0001A' + i + '\u0001', html);
    });
    return s;
  }

  /* ---------- 打字音：与 ARCHIVE 同款「老式打字机」合成（无需音频文件） ----------
     · 铅字击打：一段带通白噪 + 高频高通，几毫秒内衰减 → 「嗒」
     · 字杆回弹：一段下滑的三角波 → 闷闷的「笃」
     · 回车铃：两个正弦音，长衰减（打完最后一行时响一次）
     浏览器不允许无手势出声：打字开始先尝试 resume，不行就等用户第一次点/按键唤醒，
     没唤醒就安静跳过 —— 不报错、不打扰。 */
  let _ac = null, _master = null, _noiseBuf = null;
  function ensureAudio() {
    try {
      if (!_ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        _ac = new AC();
        const g = _ac.createGain();
        g.gain.value = 0.15;                   /* 整体很轻，只是「背景里有台打字机」 */
        g.connect(_ac.destination);
        _master = g;
        const len = Math.floor(_ac.sampleRate * 0.2);
        _noiseBuf = _ac.createBuffer(1, len, _ac.sampleRate);
        const d = _noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (_ac.state === 'suspended') _ac.resume();
    } catch (e) {}
  }
  function playTick(level) {
    if (!_ac || _ac.state !== 'running') return;
    try {
      level = level || 1;
      const t = _ac.currentTime + 0.001 + Math.random() * 0.005;

      /* 1) 铅字击打 */
      const src = _ac.createBufferSource();
      src.buffer = _noiseBuf;
      src.playbackRate.value = 0.85 + Math.random() * 0.4;
      const bp = _ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000 + Math.random() * 1600;
      bp.Q.value = 1.3;
      const hp = _ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 800;
      const g = _ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((0.42 + Math.random() * 0.3) * level, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(_master);
      src.start(t); src.stop(t + 0.09);

      /* 2) 字杆落下的闷响 */
      const o = _ac.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210 + Math.random() * 50, t);
      o.frequency.exponentialRampToValueAtTime(92, t + 0.05);
      const g2 = _ac.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.11 * level, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0004, t + 0.06);
      o.connect(g2); g2.connect(_master);
      o.start(t); o.stop(t + 0.08);
    } catch (e) {}
  }
  function playBell() {
    if (!_ac || _ac.state !== 'running') return;
    try {
      const t = _ac.currentTime + 0.005;
      [1318.5, 1975.5].forEach(function (f, i) {
        const o = _ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = _ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07 / (i + 1), t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0003, t + 0.9);
        o.connect(g); g.connect(_master);
        o.start(t); o.stop(t + 0.95);
      });
    } catch (e) {}
  }
  // 浏览器自动播放策略：必须在用户手势后才能出声，提前挂一次性监听
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, ensureAudio, { passive: true, once: true });
  });

  /* ---------- 两位成员：头像 + 代码介绍，轮流展示 ----------
     用两个斜杠 // 区分两位；每位打完停留 1.5 秒，再自动切到下一位重新打印。
     代码行用 \t 表示缩进（渲染成 4 个空格），保证 Python 缩进对齐。 */
  const PEOPLE = [
    {
      name: 'YUNSHANGNANCHEN',
      avatar: 'assets/avatar-yunshangnanchen.jpg',
      url: 'https://github.com/yunshangnanchen',
      lang: 'c',
      lines: [
        '// YUNSHANGNANCHEN',
        '// Core team members of the studio.',
        '// Currently learning Rust to complete low-level development transition from C to Rust.',
        '#include <stdio.h>',
        'int main() {',
        '\tprintf("Hello, World!\\n");',
        '\treturn 0;',
        '}'
      ]
    },
    {
      name: 'YUNSHANG · FENG',
      avatar: 'assets/avatar-canfengplaeir.jpg',
      url: 'https://github.com/canfengplaeir',
      lang: 'py',
      lines: [
        '# YUNSHANG · FENG',
        '# Core team members of the studio.',
        '# Currently learning Rust to complete low-level development transition from C to Rust.',
        'def main() -> int:',
        '\tprint("Hello, World!")',
        '\treturn 0',
        'if __name__ == "__main__":',
        '\traise SystemExit(main())'
      ]
    }
  ];

  function highlightFor(lang, raw) {
    return lang === 'py' ? highlightPy(raw) : highlightC(raw);
  }

  /* 首行（注释行）里的名字部分包成可点击链接，跳到对应 GitHub；
     注释前缀（// / #）保持绿色注释高亮，名字本身用链接色区分 */
  function nameLinkHTML(person) {
    const raw = person.lines[0] || '';
    const text = raw.replace(/\t/g, '    ');
    if (!person.url) return highlightFor(person.lang, text);
    const m = text.match(/^(\s*)(\/\/\s*|#\s*)(.+)$/);
    if (!m) return highlightFor(person.lang, text);
    const prefix = m[1] + m[2];                       // 缩进 + 注释标记
    const name   = m[3];                              // 名字文本
    return highlightFor(person.lang, prefix) +
           '<a class="name-link" href="' + person.url + '" target="_blank" rel="noopener">' +
           escapeHtml(name) + '</a>';
  }

  /* ---------- 头像 DOM 引用 + 切换头像（换 src 后重画像素层） ---------- */
  const avBox   = doc.querySelector('.about-avatar');
  const avImg   = doc.getElementById('aboutAvatar');
  const avMono  = doc.getElementById('avMono');
  const avColor = doc.getElementById('avColor');
  const avScan  = doc.getElementById('avScan');
  const AV_GRID = 48;
  let pixelReady = false;
  let printing = false;
  let aboutOpen = false;
  let currentAvatar = '';

  function setAvatar(src) {
    if (!avImg || !src) return;
    if (src === currentAvatar) return;
    currentAvatar = src;
    // 退化成首字母后（error 触发）会隐藏 img，这里恢复
    avImg.style.display = '';
    avBox.classList.remove('is-pixel', 'is-printing', 'is-fallback');
    printing = false;
    pixelReady = false;
    avImg.onload = drawPixels;
    avImg.src = src;
  }

  function drawPixels() {
    if (!avImg || !avMono || !avColor) return;
    const nw = avImg.naturalWidth, nh = avImg.naturalHeight;
    if (!nw || !nh) return;
    const side = Math.min(nw, nh);
    const sx = (nw - side) / 2, sy = (nh - side) / 2;
    [avMono, avColor].forEach(function (cv) {
      cv.width = AV_GRID;
      cv.height = AV_GRID;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(avImg, sx, sy, side, side, 0, 0, AV_GRID, AV_GRID);
    });
    pixelReady = true;
    if (aboutOpen) startPrint();
  }

  function startPrint() {
    if (printing || !pixelReady || !avBox) return;
    if (!doc.body.contains(avMono)) return;
    printing = true;
    avBox.classList.add('is-pixel', 'is-printing');
    gsap.set([avMono, avColor], { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(avScan, { top: '0%', opacity: 1 });
    const TOTAL = 1.5;
    const LEAD  = 0.32;
    gsap.timeline()
      .to(avMono,  { clipPath: 'inset(0% 0% 0% 0%)', duration: TOTAL, ease: 'none' }, 0)
      .to(avColor, { clipPath: 'inset(0% 0% 0% 0%)', duration: TOTAL, ease: 'none' }, LEAD)
      .to(avScan,  { top: '100%', duration: TOTAL, ease: 'none' }, 0)
      .to(avScan,  { opacity: 0, duration: 0.4 }, TOTAL - 0.2);
  }

  /* 渲染某位成员的完整代码块（.code-body 清空重建） */
  function renderPerson(person) {
    if (!codeBodyEl) return;
    codeBodyEl.innerHTML = '';
    const lines = [];
    person.lines.forEach(function (raw, i) {
      const line = doc.createElement('div');
      line.className = 'code-line';
      const text = raw.replace(/\t/g, '    ');   // tab → 4 空格缩进

      const ln = doc.createElement('span');
      ln.className = 'ln';
      ln.textContent = String(i + 1);

      const sep = doc.createElement('span');
      sep.className = 'sep';
      sep.textContent = '|';

      const lc = doc.createElement('span');
      lc.className = 'lc';
      lc.innerHTML = '';                         // 打字前清空

      line.appendChild(ln);
      line.appendChild(sep);
      line.appendChild(lc);
      codeBodyEl.appendChild(line);

      lines.push({ line: line, lc: lc, text: text });
    });
    currentLines = lines;
  }

  /* ---------- 尊重「减少动态效果」：直接显示第一位终态，不打字、不轮播 ---------- */
  const reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    renderPerson(PEOPLE[0]);
    currentLines.forEach(function (d, i) {
      d.lc.innerHTML = (i === 0) ? nameLinkHTML(PEOPLE[0]) : highlightFor(PEOPLE[0].lang, d.text);
      gsap.set(d.line, { autoAlpha: 1 });
    });
    if (avatar)   gsap.set(avatar,   { autoAlpha: 1, y: 0, scale: 1 });
    if (codeBlock) gsap.set(codeBlock, { autoAlpha: 1 });
    if (avImg) setAvatar(PEOPLE[0].avatar);
    return;
  }

  if (avatar)    gsap.set(avatar,    { y: 26, autoAlpha: 0, scale: 0.96 });
  // 注意：打字本身用普通 setTimeout 驱动，不依赖 GSAP 补间完成，
  // 这样即便 GSAP 的 ticker 在某些环境（如 headless 虚拟时间）下推进缓慢，
  // 文字仍会逐字出现。codeBlock 在打字开始时立即显现。
  gsap.set('.code-body .code-line', { autoAlpha: 0 });

  let typed = false;
  let personIdx = 0;
  let timer = null;
  let autoAdvance = true;   // 自动轮播开关：用户点过切换器后置 false，不再自动切
  let typeToken = 0;        // 打印代际：切换成员时递增，用来终止上一段还在跑的打字链

  /* 打字当前成员；全部打完 → 响一声「叮咚」→ 若仍允许自动轮播，停留 1.5 秒后切下一位 */
  function typePerson() {
    const token = ++typeToken;
    const person = PEOPLE[personIdx];
    renderPerson(person);
    setAvatar(person.avatar);
    if (codeBlock) gsap.set(codeBlock, { autoAlpha: 1 });
    updateSwitch();

    const lines = currentLines;
    let li = 0;
    function typeLine() {
      if (token !== typeToken) return;      // 已被新的打印取代，立刻停
      if (li >= lines.length) {
        playBell();                          // 全部打完，响一声回车铃（叮咚）
        timer = setTimeout(function () {
          if (token !== typeToken) return;
          if (!autoAdvance) return;          // 用户手动切过 → 停在这位，不再自动轮播
          personIdx = (personIdx + 1) % PEOPLE.length;
          typePerson();
        }, 1500);
        return;
      }
      const cur = lines[li];
      gsap.set(cur.line, { autoAlpha: 1 });   // 立即可见，无需等待补间
      let ci = 0;
      const text = cur.text;
      (function step() {
        if (token !== typeToken) return;     // 已被取代
        if (ci <= text.length) {
          cur.lc.innerHTML = highlightFor(person.lang, text.slice(0, ci)) + '<span class="tk-caret"></span>';
          // 空格轻一点，其余正常；跟 ARCHIVE 打标题同款手感（每次打印都响）
          playTick(text.charAt(ci) === ' ' ? 0.5 : 0.78);
          ci++;
          setTimeout(step, 14 + Math.random() * 16);
        } else {
          // 首行是名字注释行：收尾时把名字部分换成可点击的 GitHub 链接
          cur.lc.innerHTML = (li === 0) ? nameLinkHTML(person) : highlightFor(person.lang, text);
          li++;
          typeLine();
        }
      })();
    }
    typeLine();
  }

  /* ---------- 两位成员切换器：两个横杠，点击切换（并停止自动轮播） ---------- */
  const switchEl = doc.getElementById('peopleSwitch');
  if (switchEl) {
    PEOPLE.forEach(function (p, i) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'ps-bar';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-label', '切换至 ' + p.name);
      b.addEventListener('click', function () { switchTo(i); });
      switchEl.appendChild(b);
    });
  }
  function updateSwitch() {
    if (!switchEl) return;
    Array.prototype.forEach.call(switchEl.children, function (b, i) {
      const on = i === personIdx;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function switchTo(i) {
    const changed = (i !== personIdx);
    personIdx = i;
    autoAdvance = false;                    // 无论点哪个，都停止自动轮播（点当前人也停住）
    if (timer) { clearTimeout(timer); timer = null; }
    if (changed && typed) {
      typePerson();                         // 切到不同成员才重新打印
    } else {
      updateSwitch();                       // 点当前人 / 尚未开始打字：只刷新高亮
    }
  }
  updateSwitch();

  function runTypewriter() {
    if (typed) return;
    typed = true;
    ensureAudio();
    typePerson();
  }

  /* ---------- 初始头像：HTML 里已写好第一位的 src，这里补一次像素绘制 ---------- */
  if (avImg) {
    currentAvatar = avImg.src;
    if (avImg.complete && avImg.naturalWidth) drawPixels();
    else avImg.addEventListener('load', drawPixels, { once: true });
  }

  // 调试用：控制台 NCJAvatar.print() 可手动触发一次打印（不影响自动流程）
  window.NCJAvatar = { draw: drawPixels, print: startPrint };

  /* ---------- 滚动进入「关于我」视口时触发打字 + 头像打印 ---------- */
  let aboutSeen = false;

  gsap.timeline({
    scrollTrigger: {
      trigger: '.about', start: 'top 78%', once: true,
      onEnter: function () {
        aboutSeen = true;
        aboutOpen = true;                     // 头像图片晚到也能补打
        runTypewriter();
        gsap.delayedCall(0.45, startPrint);   // 等头像框淡入站稳，再开始打印
      }
    }
  })
    .to(avatar, { y: 0, autoAlpha: 1, scale: 1, duration: 0.9, ease: 'power3.out' });

})();

/* ============================================================
   「关于我」头像：拿不到 GitHub 头像时退化成首字母方块，避免破图
   ============================================================ */
(function () {
  const img = document.getElementById('aboutAvatar');
  if (!img) return;
  img.addEventListener('error', function () {
    const box = img.parentNode;
    img.style.display = 'none';
    if (!box) return;
    box.classList.add('is-fallback');
    box.textContent = 'N';          // 改成你名字的首字母
  }, { once: true });
})();
