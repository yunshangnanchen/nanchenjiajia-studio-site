/* ============================================================
   页面转场（纯静态多页公用）
   1) 点击站内链接 → 黑幕淡入 → 再跳转，避免白屏闪一下
   2) 新页面首帧黑幕已经是全黑的 → 淡出，露出内容
   ============================================================ */
(function () {
  var LEAVE_KEY = 'ncj:leaving';
  var veil = document.getElementById('pageVeil');
  var root = document.documentElement;
  if (!veil) return;

  /* ---------- 1. 进入新页面：黑幕淡出 ---------- */
  var leaving = false;
  try {
    leaving = sessionStorage.getItem(LEAVE_KEY) === '1';
    sessionStorage.removeItem(LEAVE_KEY);      // 只用一次，防止刷新时又黑一次
  } catch (e) {}

  if (leaving) {
    // 首帧已经由 <head> 里的 html.veil-on 盖住，这里切回用过渡的版本再淡出
    var fadeOut = function () {
      root.classList.remove('veil-on');
      veil.classList.add('is-on');
      requestAnimationFrame(function () {
        veil.classList.remove('is-on');        // 触发 0.42s 淡出
      });
    };
    requestAnimationFrame(function () { requestAnimationFrame(fadeOut); });
    setTimeout(fadeOut, 120);                  // 后台标签页 rAF 不跑时的兜底
  } else {
    root.classList.remove('veil-on');
  }

  /* ---------- 2. 离开当前页：黑幕淡入再跳转 ---------- */
  // 黑幕时长刻意比 CSS 的 transition (0.42s) 短一截：不等到完全黑就跳转，
  // 让音乐跨页续播的断档尽量短（跳转越早，新页面的音频越早接上）
  var FADE = 240;   // 黑幕淡入到 ~70% 就跳转，剩余过渡由新页面的淡出衔接

  function sameSite(href) {
    // 只处理站内页面：github.html / index.html / index.html#about 之类
    var a = document.createElement('a');
    a.href = href;
    if (a.target === '_blank') return false;
    // file:// 下 host 为空，只要不是 http(s) 外链就当站内
    if (a.protocol === 'http:' || a.protocol === 'https:') {
      return a.host === location.host;
    }
    return a.protocol === 'file:' || a.protocol === '';
  }

  function isPlainClick(e) {
    return !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey ||
             e.shiftKey || e.altKey);
  }

  document.addEventListener('click', function (e) {
    if (!isPlainClick(e)) return;
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === 'A' && el.getAttribute('href')) break;
      el = el.parentNode;
    }
    if (!el || el.tagName !== 'A') return;

    var href = el.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;          // 同页锚点：交给平滑滚动
    if (el.target === '_blank' || el.hasAttribute('download')) return;
    if (!sameSite(href)) return;
    if (el.classList.contains('no-transition')) return;

    // 目标就是当前页面（只差 hash）→ 不拦截
    var a = document.createElement('a');
    a.href = href;
    if (a.pathname === location.pathname && a.search === location.search) {
      if (a.hash) { e.preventDefault(); location.hash = a.hash; }
      return;
    }

    e.preventDefault();
    try { sessionStorage.setItem(LEAVE_KEY, '1'); } catch (err) {}

    veil.classList.add('is-on');                          // 黑幕淡入
    setTimeout(function () { location.href = href; }, FADE + 40);

    // 兜底：万一跳转被拦下（比如断网），把黑幕收回去
    setTimeout(function () { veil.classList.remove('is-on'); }, FADE + 2000);
  });

  /* ---------- 3. 前进/后退：别让黑幕留着 ---------- */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {                                    // 从浏览器缓存恢复
      root.classList.remove('veil-on');
      veil.classList.remove('is-on');
      try { sessionStorage.removeItem(LEAVE_KEY); } catch (err) {}
    }
  });
})();
