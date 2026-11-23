/* The live details on the sheet (date, time, moon, counts), images fading
   in as they load, the night sky, and the full-screen viewer. Without
   JavaScript the page still reads fine and each painting opens as a plain
   image. */
(function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
  var TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  function decoded(im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }

  /* ----------------------------------------------------------- the sheet */

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  var pieces = document.querySelectorAll('.piece');
  each('[data-works]', function (el) { el.textContent = pad(pieces.length); });
  each('[data-fig-range]', function (el) { el.textContent = '01–' + pad(pieces.length); });

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function tick() {
    var now = new Date();
    var hh = pad(now.getHours()), mm = pad(now.getMinutes());
    each('[data-date]', function (el) {        // e.g. 23 NOV 2026, in the visitor's own time zone
      el.textContent = pad(now.getDate()) + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
      el.dateTime = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    });
    each('[data-time]', function (el) {
      el.innerHTML = hh + '<span class="colon">:</span>' + mm;
      el.dateTime = hh + ':' + mm;
    });
  }

  /* The moonphase dial. The disc carries two moons and makes half a turn
     per lunar month (29.53 days), counted from a known new moon. */
  var moon = document.querySelector('[data-moon]');
  var SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  var PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
    'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

  function setMoon() {
    if (!moon) return;
    var p = ((Date.now() - NEW_MOON) / 86400000 / SYNODIC) % 1;
    if (p < 0) p += 1;
    moon.style.setProperty('--moon-turn', (p * 180 - 90).toFixed(2) + 'deg');
    var lit = Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100);
    var label = moon.querySelector('title');
    if (label) label.textContent = PHASES[Math.round(p * 8) % 8] + ', ' + lit + '% lit';
  }

  tick();
  // after the first paint, so the disc turns into place
  requestAnimationFrame(function () { requestAnimationFrame(setMoon); });
  setTimeout(function () {
    tick();
    setInterval(function () { tick(); setMoon(); }, 60000);
  }, (60 - new Date().getSeconds()) * 1000);

  /* -------------------------------------------------------- the night sky */
  /* Every so often a satellite drifts across behind the sheet, trailing a
     dashed line, or a meteor streaks past. One of each at a time. */

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'animate' in Element.prototype) {
    var sky = document.createElement('div');
    sky.className = 'sky';
    sky.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(sky, document.body.firstChild);

    var rand = function (a, b) { return a + Math.random() * (b - a); };
    var later = function (fn, min, max) {
      setTimeout(function run() {
        if (document.hidden) { setTimeout(run, 5000); return; } // wait for the tab to be seen
        fn();
      }, rand(min, max) * 1000);
    };

    var SATELLITE = '<svg class="sat__body" viewBox="0 0 30 14">' +
      '<path d="M1.5 4h8v6h-8zM5.5 4v6M20.5 4h8v6h-8zM24.5 4v6M9.5 7h2M18.5 7h2M11.5 4.5h7v5h-7zM15 4.5V2.5"/>' +
      '<circle class="sat__light" cx="15" cy="1.5" r="1"/></svg>';

    var satellite = function () {
      var W = window.innerWidth, H = window.innerHeight;
      var ltr = Math.random() < 0.65;
      var x0 = ltr ? -40 : W + 40, y0 = H * rand(0.12, 0.75);
      var dx = (ltr ? W + 40 : -40) - x0, dy = H * rand(-0.25, 0.25);
      var dist = Math.hypot(dx, dy) + 240;               // let the trail leave too
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var time = dist / rand(26, 36) * 1000;              // about 30px a second

      var el = document.createElement('div');
      el.className = 'sat';
      el.innerHTML = '<i class="sat__trail"></i>' + SATELLITE;
      el.style.left = x0 + 'px';
      el.style.top = y0 + 'px';
      el.lastChild.style.transform = 'rotate(' + (-ang) + 'deg)'; // keep it upright
      sky.appendChild(el);

      var heading = 'rotate(' + ang + 'deg) ';
      el.animate([
        { transform: heading + 'translateX(0)' },
        { transform: heading + 'translateX(' + dist + 'px)' }
      ], { duration: time, easing: 'linear' }).onfinish = function () {
        el.remove();
        later(satellite, 50, 110);
      };
      // slide the dashes backward at the same speed, so the trail stays put
      // on the sheet and fades out behind the satellite
      el.firstChild.animate([
        { backgroundPosition: '0 0' },
        { backgroundPosition: -dist + 'px 0' }
      ], { duration: time, easing: 'linear' });
    };

    var meteor = function () {
      var W = window.innerWidth, H = window.innerHeight;
      var len = rand(80, 150), dist = rand(220, 420);
      var ang = Math.random() < 0.5 ? rand(18, 38) : rand(142, 162);
      var el = document.createElement('i');
      el.className = 'meteor';
      el.style.width = len + 'px';
      el.style.left = (W * rand(0.1, 0.9) - len) + 'px';
      el.style.top = (H * rand(0.06, 0.55)) + 'px';
      sky.appendChild(el);

      var heading = 'rotate(' + ang + 'deg) ';
      el.animate([
        { transform: heading + 'translateX(0) scaleX(0.2)', opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.6 },
        { transform: heading + 'translateX(' + dist + 'px) scaleX(1)', opacity: 0 }
      ], { duration: rand(800, 1300), easing: 'cubic-bezier(0.3, 0, 0.6, 1)' }).onfinish = function () {
        el.remove();
        later(meteor, 16, 40);
      };
    };

    later(satellite, 2, 5);
    later(meteor, 8, 14);
  }

  /* ---------------------------------------------------------- the viewer */
  /* One painting at a time, as large as the screen allows. It opens on the
     grid image (already loaded) and swaps in the full-resolution photo.
     Click the picture (or press Z) to look closer at the surface. Each work
     has its own link (…/#untitled-iv) and the Back button closes it. */

  var viewer = document.querySelector('.viewer');
  var links = Array.prototype.slice.call(document.querySelectorAll('.piece__link'));
  if (!viewer || typeof viewer.showModal !== 'function' || !links.length) return;

  var img = viewer.querySelector('[data-img]');
  var stage = viewer.querySelector('[data-stage]');
  var title = viewer.querySelector('[data-title]');
  var meta = viewer.querySelector('[data-meta]');
  var count = viewer.querySelector('[data-count]');
  var zoomButton = viewer.querySelector('[data-zoom]');
  var pageTitle = document.title, artist = pageTitle.split(' — ')[0];
  var index = 0, token = 0, loadingTimer = 0, closingByHistory = false, opener = null;

  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var works = links.map(function (link) {
    var piece = link.closest('.piece');
    var thumb = link.querySelector('img');
    return {
      id: piece.id,
      full: link.getAttribute('href'),
      thumb: thumb,
      ar: (+thumb.getAttribute('width') || 4) / (+thumb.getAttribute('height') || 5),
      alt: thumb.alt,
      title: text(piece.querySelector('.piece__title')),
      meta: text(piece.querySelector('.piece__meta'))
    };
  });

  function find(hash) {
    var id = decodeURIComponent((hash || '').replace(/^#/, ''));
    for (var i = 0; i < works.length; i++) if (id && works[i].id === id) return i;
    return -1;
  }

  function preload(i) {
    var im = new Image();
    im.decoding = 'async';
    im.src = works[(i + works.length) % works.length].full;
  }

  function show(i) {
    index = (i + works.length) % works.length;
    var work = works[index], mine = ++token;
    setZoom(false);
    viewer.style.setProperty('--ar', work.ar.toFixed(4));
    title.textContent = work.title;
    meta.textContent = work.meta;
    count.textContent = 'Fig. ' + pad(index + 1) + ' / ' + pad(works.length);
    img.alt = work.alt;
    document.title = work.title + ' — ' + artist;

    // the grid image is already here: show it straight away
    var t = work.thumb;
    img.src = t.complete && t.naturalWidth ? (t.currentSrc || t.src) : TRANSPARENT;

    // then the full-resolution photo; say "Loading" only if it takes a while
    viewer.classList.remove('is-loading');
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(function () { if (mine === token) viewer.classList.add('is-loading'); }, 350);
    var full = new Image();
    full.decoding = 'async';
    full.onload = function () {
      decoded(full).then(function () {
        if (mine !== token) return;
        img.src = work.full;
        clearTimeout(loadingTimer);
        viewer.classList.remove('is-loading');
        preload(index + 1);
        preload(index - 1);
      });
    };
    full.onerror = function () {
      if (mine !== token) return;
      clearTimeout(loadingTimer);
      viewer.classList.remove('is-loading');
    };
    full.src = work.full;
  }

  function open(i, initial) {
    show(i);
    opener = links[index];
    var hash = works[index].id ? '#' + works[index].id : location.hash;
    if (initial) history.replaceState({ viewer: true, initial: true }, '', hash);
    else history.pushState({ viewer: true }, '', hash);
    if (!viewer.open) viewer.showModal();
  }

  function go(step) {
    show(index + step);
    if (works[index].id) history.replaceState(history.state, '', '#' + works[index].id);
  }

  // Every way of closing (button, Esc, clicking outside, Back) ends here
  viewer.addEventListener('close', function () {
    setZoom(false);
    token++;
    clearTimeout(loadingTimer);
    viewer.classList.remove('is-loading');
    document.title = pageTitle;
    // back to the painting the viewer was showing, so keyboard users keep their place
    var back = links[index] || opener;
    if (back) back.focus({ preventScroll: true });
    if (closingByHistory) { closingByHistory = false; return; }
    var state = history.state;
    if (state && state.viewer) {
      if (state.initial) history.replaceState(null, '', location.pathname + location.search);
      else history.back();
    }
  });

  window.addEventListener('popstate', function (e) {
    var i = find(location.hash);
    if (e.state && e.state.viewer && i >= 0) {
      show(i);
      if (!viewer.open) viewer.showModal();
    } else if (viewer.open) {
      closingByHistory = true;
      viewer.close();
    }
  });

  // A painting's address typed or pasted while already on the page
  window.addEventListener('hashchange', function () {
    var i = find(location.hash);
    if (i < 0 || viewer.open) return;
    show(i);
    opener = links[index];
    history.replaceState({ viewer: true }, '', location.hash);
    viewer.showModal();
  });

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(i, false);
    });
  });

  /* -- looking closer */

  var zoomed = false, fit = null, origin = { x: 0.5, y: 0.5 }, z = 2;

  function setOrigin(x, y) {
    origin.x = Math.max(0, Math.min(1, x));
    origin.y = Math.max(0, Math.min(1, y));
    img.style.setProperty('--ox', (origin.x * 100).toFixed(2) + '%');
    img.style.setProperty('--oy', (origin.y * 100).toFixed(2) + '%');
  }

  function setZoom(on, x, y) {
    if (on && !zoomed) {
      fit = img.getBoundingClientRect();        // the picture's size before zooming
      var natural = img.naturalWidth > 2 ? img.naturalWidth : fit.width * 2;
      z = Math.max(2, Math.min(4, natural / fit.width));
      viewer.style.setProperty('--z', z.toFixed(3));
      setOrigin(x == null ? 0.5 : x, y == null ? 0.5 : y);
    }
    zoomed = !!on;
    viewer.classList.toggle('is-zoomed', zoomed);
    if (zoomButton) zoomButton.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
  }

  window.addEventListener('resize', function () { if (zoomed) setZoom(false); });

  var down = null, moved = false;
  stage.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY, t: Date.now(), type: e.pointerType, ox: origin.x, oy: origin.y };
    moved = false;
  });
  stage.addEventListener('pointermove', function (e) {
    if (zoomed && fit && e.pointerType === 'mouse') {
      // like a magnifying glass: the photo follows the mouse
      setOrigin((e.clientX - fit.left) / fit.width, (e.clientY - fit.top) / fit.height);
      return;
    }
    if (!down) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
    if (zoomed && fit && down.type !== 'mouse') {
      // drag to move around the enlarged photo
      viewer.classList.add('is-dragging');
      setOrigin(down.ox - dx / (fit.width * (z - 1)), down.oy - dy / (fit.height * (z - 1)));
    }
  });
  function lift(e) {
    if (!down) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    viewer.classList.remove('is-dragging');
    // a quick sideways swipe browses (not while zoomed: then it moves the photo)
    if (!zoomed && down.type !== 'mouse' && Date.now() - down.t < 600 &&
        Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      moved = true;
      go(dx < 0 ? 1 : -1);
    }
    down = null;
  }
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', function () { down = null; viewer.classList.remove('is-dragging'); });

  viewer.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-close]')) { viewer.close(); return; }
    if (t.closest('[data-prev]')) { go(-1); return; }
    if (t.closest('[data-next]')) { go(1); return; }
    if (t.closest('[data-zoom]')) { setZoom(!zoomed); return; }
    if (moved) return;                      // that was a drag or a swipe, not a click
    if (t === img) {
      if (zoomed) { setZoom(false); return; }
      var r = img.getBoundingClientRect();
      setZoom(true, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    } else if (t === stage && !zoomed) {
      viewer.close();
    }
  });

  // Listened for on the whole document: when the viewer opens from a link,
  // the browser's own jump to that painting can leave focus outside it.
  document.addEventListener('keydown', function (e) {
    if (!viewer.open || e.altKey || e.metaKey || e.ctrlKey) return;
    var step = 0.1;
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); if (zoomed) setOrigin(origin.x - step, origin.y); else go(-1); break;
      case 'ArrowRight': e.preventDefault(); if (zoomed) setOrigin(origin.x + step, origin.y); else go(1); break;
      case 'ArrowUp': if (zoomed) { e.preventDefault(); setOrigin(origin.x, origin.y - step); } break;
      case 'ArrowDown': if (zoomed) { e.preventDefault(); setOrigin(origin.x, origin.y + step); } break;
      case 'z': case 'Z': e.preventDefault(); setZoom(!zoomed); break;
    }
  });

  // Esc steps back out of the zoom first, then closes
  viewer.addEventListener('cancel', function (e) {
    if (zoomed) { e.preventDefault(); setZoom(false); }
  });

  // A link straight to one painting (…/#untitled-iv) opens it
  var start = find(location.hash);
  if (start >= 0) {
    open(start, true);
    // the browser jumps to the linked painting as the page finishes loading,
    // which takes focus off the viewer; put it back
    window.addEventListener('load', function () {
      setTimeout(function () {
        var close = viewer.querySelector('[data-close]');
        if (viewer.open && close && !viewer.contains(document.activeElement)) close.focus({ preventScroll: true });
      }, 0);
    }, { once: true });
  }
})();
