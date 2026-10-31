/* bgm.js — 全站背景音乐（featherfall.mp3）
   在导航栏 HOME 左侧生成一个小三角按钮：
   · 点击播放 → 三角变成跳动的迷你频谱条
   · 再点暂停 → 变回三角
   音乐页播放曲目时会自动暂停本背景音乐（studio.html 调用 window.SiteBGM.pause()）。
   迷你频谱为纯 CSS 动画，不依赖 Web Audio，保证浏览器自动播放策略下也能出声。 */
(function () {
  'use strict';

  var SRC   = 'assets/audio/featherfall.mp3';
  var STORE = 'ncj:bgm';

  /* 进站自动播放开关
     false = 打开网站不出声，只有点导航栏三角才播；
     true  = 进站即播放 Featherfall，被浏览器拦截时退化为首次交互起播。 */
  var AUTOPLAY = true;

  function init() {
    var menu = document.querySelector('.navbar .menu') || document.querySelector('.menu');
    if (!menu) return;
    if (document.querySelector('.bgm-toggle')) return;   // 防止重复注入

    /* ---- 生成按钮：三角 + 迷你频谱条 ---- */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bgm-toggle';
    btn.setAttribute('aria-label', '网站背景音乐：播放');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = '背景音乐';
    btn.innerHTML =
      '<span class="bgm-tri" aria-hidden="true"></span>' +
      '<span class="bgm-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    /* 按钮放哪：宽屏在 HOME 左侧（塞进 .menu），竖屏菜单收成下拉，
       按钮挪到导航栏左边那一格，避免变成下拉菜单里的一行 */
    var navbar = document.querySelector('.navbar');
    var narrowMQ = window.matchMedia('(max-width: 720px)');
    function placeBtn() {
      if (narrowMQ.matches && navbar) {
        if (btn.parentNode !== navbar) navbar.appendChild(btn);
      } else if (btn.parentNode !== menu) {
        menu.insertBefore(btn, menu.firstElementChild);
      }
    }
    placeBtn();
    if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', placeBtn);
    else if (narrowMQ.addListener) narrowMQ.addListener(placeBtn);

    /* ---- 三角 ⇄ 迷你频谱 的 GSAP 过渡动画 ----
       · 三角：缩小 + 旋转 + 淡出；频谱条：整体弹出 + 每根竖条从底部拉起（stagger）
       · 反向：竖条依次压扁 → 整体缩回 → 三角旋转着弹回
       · 无 GSAP 时自动降级为 CSS 过渡（见 style.css 的 :not(.is-gsap) 分支） */
    var gsapOK = !!(window.gsap && window.gsap.to);
    var tri    = btn.querySelector('.bgm-tri');
    var bars   = btn.querySelector('.bgm-bars');
    var barItems = bars ? Array.prototype.slice.call(bars.querySelectorAll('i')) : [];
    var loopTweens = [];
    var toggleTL = null;

    if (gsapOK) {
      btn.classList.add('is-gsap');
      gsap.set(tri,  { autoAlpha: 1, scale: 1, rotate: 0 });
      gsap.set(bars, { autoAlpha: 0, scale: 0.6 });
      gsap.set(barItems, { scaleY: 0 });
    }

    /* 频谱跳动：每根竖条各自随机高度、随机时长，yoyo 来回，形成不规则律动 */
    function startBarsLoop() {
      if (!gsapOK) return;
      stopBarsLoop();
      barItems.forEach(function (bar, i) {
        loopTweens.push(gsap.to(bar, {
          scaleY: 'random(0.2, 1)',
          duration: 0.42 + Math.random() * 0.42,
          repeat: -1,
          yoyo: true,
          repeatDelay: 0.04,
          ease: 'sine.inOut',
          delay: i * 0.04
        }));
      });
    }
    function stopBarsLoop() {
      loopTweens.forEach(function (t) { if (t) t.kill(); });
      loopTweens = [];
    }

    /* playing=true：三角 → 频谱；false：频谱 → 三角 */
    function animateToggle(playing) {
      if (!gsapOK) return;                       // 降级交给 CSS
      if (toggleTL) { toggleTL.kill(); toggleTL = null; }
      stopBarsLoop();
      gsap.killTweensOf([tri, bars].concat(barItems));

      if (playing) {
        gsap.set(barItems, { scaleY: 0 });
        toggleTL = gsap.timeline()
          .to(tri, { autoAlpha: 0, scale: 0.2, rotate: -110, duration: 0.22, ease: 'power2.in' })
          .fromTo(bars, { autoAlpha: 0, scale: 0.6 },
            { autoAlpha: 1, scale: 1, duration: 0.34, ease: 'back.out(2.4)' }, '-=0.08')
          .fromTo(barItems, { scaleY: 0 },
            { scaleY: 1, duration: 0.34, ease: 'back.out(3)', stagger: 0.03 }, '-=0.3')
          .add(startBarsLoop);
      } else {
        toggleTL = gsap.timeline()
          .to(barItems, { scaleY: 0, duration: 0.2, ease: 'power2.in', stagger: 0.02 })
          .to(bars, { autoAlpha: 0, scale: 0.6, duration: 0.2, ease: 'power2.in' }, '-=0.1')
          .fromTo(tri, { autoAlpha: 0, scale: 0.2, rotate: 110 },
            { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(2.6)' }, '-=0.12');
      }
    }

    /* ---- 音频 ---- */
    var audio = new Audio();
    audio.src = SRC;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.45;
    window.__siteBgmAudio = audio;   // 防止被回收

    /* ---- 跨页续播：STUDIO 里选中的曲目，切到别的页面接着放 ----
       studio 页有自己的播放器（会自己从原位置恢复），这里只管其它页面：
       发现 sessionStorage 里有「正在播放」的曲目，就把本页的 audio 切过去接管。
       若曲目是暂停态（track.playing=false），则不接管 —— 回到 featherfall 背景音乐，
       避免「既不放 studio 曲目也不放背景音乐」的静音。 */
    var TRACK_STORE = 'ncj:track';
    var hasPlayer  = !!document.querySelector('.music-page');
    var track = null;
    try { track = JSON.parse(sessionStorage.getItem(TRACK_STORE) || 'null'); } catch (e) {}

    var followTrack = !hasPlayer && !!(track && track.src && track.playing) &&
                      (Date.now() - (track.at || 0) < 6 * 60 * 1000);

    function saveTrackState(playing) {
      if (!followTrack) return;
      try {
        track.t = audio.currentTime || 0;
        track.at = Date.now();
        track.playing = typeof playing === 'boolean' ? playing : !audio.paused;
        sessionStorage.setItem(TRACK_STORE, JSON.stringify(track));
      } catch (e) {}
    }

    if (followTrack) {
      audio.loop = false;
      audio.volume = 1;
      audio.src = track.src;
      if (track.title) btn.title = '正在播放：' + track.title;
    }

    var lastPlaying = false;
    function setUI(playing) {
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      btn.setAttribute('aria-label', playing ? '网站背景音乐：播放中，点击暂停' : '网站背景音乐：暂停，点击播放');
      if (playing !== lastPlaying) {          // 只在状态真正变化时播放过渡动画
        lastPlaying = playing;
        animateToggle(playing);
      }
    }
    var leavingPage = false;   // 切页标志：unload 触发的 pause 不覆盖已保存的 playing 状态
    audio.addEventListener('play',    function () { setUI(true);  saveTrackState(true);  });
    audio.addEventListener('playing', function () { setUI(true);  });
    audio.addEventListener('pause',   function () { setUI(false); if (!leavingPage) saveTrackState(false); });

    /* ---- 播放 / 暂停 ---- */
    function pauseTrackPlayer() {
      if (window.MirrorPlayer && typeof window.MirrorPlayer.pause === 'function') {
        window.MirrorPlayer.pause();
      }
    }
    function playBGM() {
      window.__bgmSuppressed = true;   // 用户主动操作，取消「首次交互自动起播」
      pauseTrackPlayer();              // 避免与音乐页曲目同时出声
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
    function pauseBGM() {
      window.__bgmSuppressed = true;
      audio.pause();
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (hasPlayer) {
        /* 在 STUDIO 页：顶部按钮控制本页播放器（当前曲目），而不是 featherfall */
        window.__bgmSuppressed = true;
        if (window.MirrorPlayer && typeof window.MirrorPlayer.toggle === 'function') {
          window.MirrorPlayer.toggle();
        } else if (window.MirrorPlayer && typeof window.MirrorPlayer.pause === 'function') {
          if (window.MirrorPlayer.isPlaying && window.MirrorPlayer.isPlaying()) {
            window.MirrorPlayer.pause();
          }
        }
        return;
      }
      if (followTrack) {                       // 本页在接管 studio 的曲目
        window.__bgmSuppressed = true;
        if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
        else audio.pause();
        return;
      }
      if (audio.paused) playBGM(); else pauseBGM();
    });

    /* ---- 记住曲目进度，切页 / 刷新都不丢 ---- */
    if (followTrack) {
      window.addEventListener('pagehide', function () { leavingPage = true; saveTrackState(); });
      window.addEventListener('beforeunload', function () { leavingPage = true; saveTrackState(); });
      setInterval(function () { if (!audio.paused) saveTrackState(true); }, 2500);

      /* 恢复 studio 曲目：先把进度 seek 到位，等能播(canplay)再 play，
         避免「先从头出声再跳」的卡顿。
         播放被浏览器自动播放策略拦截时，挂首次交互兜底，保证点一下就续上。 */
      function resumeTrackPlay() {
        var gap = Math.min(3, Math.max(0, (Date.now() - (track.at || Date.now())) / 1000));
        var target = Math.max(0, (track.t || 0) + gap);
        try { audio.currentTime = target; } catch (err) {}
        var pr = audio.play();
        if (pr && pr.catch) {
          pr.catch(function () {
            setUI(false);
            if (!window.__bgmSuppressed) armFirstInteraction();
          });
        }
      }

      if (track.playing) {
        // 标记：followTrack 正在接管，下面 AUTOPLAY 别再对 featherfall 起播
        window.__followTrackResuming = true;

        if (audio.readyState >= 1) {
          resumeTrackPlay();
        } else {
          audio.addEventListener('canplay', function onCan() {
            audio.removeEventListener('canplay', onCan);
            resumeTrackPlay();
          }, { once: true });
        }
      }
    }

    /* ---- 跨页面记住播放进度，切换页面更连贯 ---- */
    function saveState() {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({ t: audio.currentTime || 0, playing: !audio.paused }));
      } catch (e) {}
    }
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);
    // 每 1.5s 存一次进度（比 pagehide 更勤），即使异常退出也能拿到较新的位置
    setInterval(function () { if (!audio.paused) saveState(); }, 1500);

    /* 上次的播放状态：t=进度，playing=当时是否在播 */
    var resume = null;
    try { resume = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) {}

    /* 续播：把进度先设好，等到能播(canplay)再决定是否 play，
       避免「先从头出声再跳」造成的杂音和卡顿。 */
    var resumeSeekDone = false;
    function seekResume() {
      if (resumeSeekDone) return;
      resumeSeekDone = true;
      if (resume && resume.t > 0.5) {
        try { audio.currentTime = resume.t; } catch (e) {}
      }
    }
    if (resume && resume.t > 0.5) {
      if (audio.readyState >= 1) seekResume();
      else audio.addEventListener('loadedmetadata', seekResume, { once: true });
    }
    // 兜底：metadata 迟迟不来也强制 seek 一次（进度不准但至少能出声）
    setTimeout(seekResume, 2500);

    /* 是否恢复「播放中」状态：切页前在播 → 切页后接着播 */
    var shouldResumePlay = !!(resume && resume.playing);

    /* ---- 自动播放：先直接尝试；被拦截则等首次交互再起 ---- */
    function armFirstInteraction() {
      var once = function (e) {
        if (e && e.target && btn.contains(e.target)) { detach(); return; }
        detach();
        setTimeout(function () {
          if (window.__bgmSuppressed) return;
          if (window.MirrorPlayer && window.MirrorPlayer.isPlaying && window.MirrorPlayer.isPlaying()) return;
          if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
        }, 90);
      };
      function detach() {
        document.removeEventListener('pointerdown', once, true);
        document.removeEventListener('keydown', once, true);
        document.removeEventListener('touchstart', once, true);
      }
      document.addEventListener('pointerdown', once, true);
      document.addEventListener('keydown', once, true);
      document.addEventListener('touchstart', once, true);
    }

    /* 真正开始播放：等进度 seek 到位（或 metadata 就绪）再 play，
       保证切页后是「接着上一段继续」，而不是从头播一下再跳。 */
    function startPlayback() {
      if (!audio.paused) return;                 // 已经在播
      if (audio.readyState >= 1) {               // 有 metadata，能直接播
        var p = audio.play();
        if (p && p.catch) p.catch(function () { if (!window.__bgmSuppressed) armFirstInteraction(); });
      } else {
        // metadata 还没到：等 canplay 再播，期间静音，避免从头出声
        audio.addEventListener('canplay', function onCan() {
          audio.removeEventListener('canplay', onCan);
          seekResume();
          var p2 = audio.play();
          if (p2 && p2.catch) p2.catch(function () { if (!window.__bgmSuppressed) armFirstInteraction(); });
        }, { once: true });
      }
    }

    /* ---- 自动播放开关：开启时先直接尝试，被拦截则等首次交互再起 ----
       注意：
       - followTrack（studio 曲目正在播）时，跳过本段，由 followTrack 自己恢复；
       - 续播场景（resume.playing）交给 startPlayback，先 seek 再出声。 */
    if (AUTOPLAY) {
      if (followTrack) {
        // 正在接管 studio 曲目：交给上面 followTrack 的恢复逻辑，这里不起播
      } else if (shouldResumePlay && resume && resume.t > 0.5) {
        // 续播 featherfall：seek 到位后再播，无缝衔接
        startPlayback();
      } else if (resume && resume.playing === false) {
        // 用户上次手动暂停过（切页/刷新前是暂停态）：尊重意图，不再自动起播
      } else {
        // 全新开始：直接从头播 featherfall
        var pp = null;
        try { pp = audio.play(); } catch (e) {}
        if (pp && pp.catch) {
          pp.catch(function () { if (!window.__bgmSuppressed) armFirstInteraction(); });
        }
      }
    } else if (shouldResumePlay && !followTrack) {
      // AUTOPLAY 关但上次在播：也恢复（保持跨页一致）
      startPlayback();
    }

    /* ---- 对外接口 ---- */
    window.SiteBGM = {
      play: playBGM,
      pause: pauseBGM,
      toggle: function () { if (audio.paused) playBGM(); else pauseBGM(); },
      isPlaying: function () { return !audio.paused; },
      /* 供 STUDIO 页播放器调用：把顶部三角按钮的 UI 同步成「本页曲目在播/暂停」 */
      syncUI: function (playing) { setUI(!!playing); },
      /* 供 STUDIO 页判断：本页是否有自己的播放器（决定按钮控制谁） */
      hasPlayer: hasPlayer
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
