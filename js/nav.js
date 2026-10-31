/* ============================================================
   顶部导航：竖屏折叠菜单
   · 宽屏（>720px）由 CSS 直接隐藏 .menu-toggle，菜单项横排带「/」分隔
   · 竖屏点三条横线展开下拉，再点 / 点空白 / 按 Esc 收起
   ============================================================ */
(function () {
  'use strict';

  var nav = document.getElementById('navbar');
  if (!nav) return;

  var btn = nav.querySelector('.menu-toggle');
  var menu = nav.querySelector('.menu');
  if (!btn || !menu) return;

  var OPEN = 'menu-open';

  function setOpen(open) {
    if (open) nav.classList.add(OPEN);
    else nav.classList.remove(OPEN);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }

  function close() { setOpen(false); }

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!nav.classList.contains(OPEN));
  });

  // 点菜单项后立即收起：站内跳转会转场，避免返回时菜单还开着
  menu.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) close();
  });

  // 点导航以外的区域 / 按 Esc 收起
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) close();
  });

  // 拉宽窗口回到宽屏时自动收起，避免留下一个不可见但占着状态的菜单
  var mq = window.matchMedia('(max-width: 720px)');
  function onChange() { if (!mq.matches) close(); }
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
