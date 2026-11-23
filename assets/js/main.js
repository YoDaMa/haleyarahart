/* The live details on the sheet (date, time, moon, counts), images fading
   in as they load, the night sky, and the full-screen viewer. Without
   JavaScript the page still reads fine and each painting opens as a plain
   image. */
(function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
  var TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // Menu links scroll to their section without leaving #info etc. in the
  // address bar, so a reload or a saved link opens at the top of the page.
  each('a[href^="#"]', function (a) {
    var id = a.getAttribute('href').slice(1);
    if (!id || /^untitled-/.test(id)) return;
    a.addEventListener('click', function (e) {
      var target = document.getElementById(id);
      if (!target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (id === 'top') window.scrollTo({ top: 0 }); else target.scrollIntoView({ block: 'start' });
      if (target.tabIndex < 0 && !/^(A|BUTTON|INPUT)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

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
  /* Every so often a meteor streaks past behind the sheet. */

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

    later(meteor, 8, 14);
  }

  /* ------------------------------------------------------- the halftone */
  /* A printed halftone screen over the blue: 1-bit dots on a 9px grid,
     their size set by slow drifting clouds. Small dots are single pixels
     and crosses; big ones are stepped circles that just touch, forming +
     shapes at the densest points. The clouds swell and shrink on a slow
     breath (one every 9 seconds). Drawn by the graphics card, and only
     where there is one: devices that would have to draw it in software skip
     it. It starts once the page has loaded; with reduced motion it holds
     still.

     PX    screen points per bitmap pixel (2 = chunkier pixels)
     CELL  dot pitch, in bitmap pixels (odd, so every dot has a center pixel)
     RMAX  largest dot radius, in bitmap pixels (CELL / 2 = just touching)
     CLOUD size of the cloud patches, in screen points (smaller on phones,
           so a single cloud never covers the whole screen) */

  (function halftone() {
    var PX = 1, CELL = 9, RMAX = 4.4;
    function cloud() { return Math.max(170, Math.min(340, document.documentElement.clientWidth * 0.24)); }
    var layer = document.createElement('div');
    layer.className = 'halftone';
    layer.setAttribute('aria-hidden', 'true');
    var canvas = document.createElement('canvas');
    layer.appendChild(canvas);
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
        stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
    } catch (err) { /* no WebGL: the page simply goes without */ }
    if (!gl) return;   // no graphics card to draw it (or no WebGL): the page goes without
    // Some browsers report software rendering only through the renderer's name
    var renderer = String(gl.getParameter(gl.RENDERER) || '');
    if (/^webkit webgl$/i.test(renderer)) {
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '');
    }
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return;

    var VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
    var FS = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform float u_h;',       // canvas height, in bitmap pixels
      'uniform float u_t;',       // seconds
      'uniform float u_breath;',  // 0 (out) .. 1 (in)
      'uniform vec4 u_ink;',      // dot color, premultiplied
      'uniform float u_cell;',    // dot pitch, bitmap pixels
      'uniform float u_rmax;',    // largest dot radius, bitmap pixels
      'uniform float u_cloud;',   // cloud size, bitmap pixels
      'float hash(vec3 p) {',
      '  p = fract(p * 0.1031);',
      '  p += dot(p, p.zyx + 31.32);',
      '  return fract((p.x + p.y) * p.z);',
      '}',
      'float noise(vec3 p) {',
      '  vec3 i = floor(p), f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),',
      '                 mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),',
      '             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),',
      '                 mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);',
      '}',
      'void main() {',
      '  vec2 px = floor(vec2(gl_FragCoord.x, u_h - gl_FragCoord.y));',
      '  vec2 cell = floor(px / u_cell);',
      '  vec2 center = cell * u_cell + floor(u_cell * 0.5);',
      '  vec2 q = center / u_cloud;',
      '  float t = u_t;',
      '  float n = 0.55 * noise(vec3(q + vec2(t * 0.010, t * 0.004), t * 0.018))',
      '          + 0.30 * noise(vec3(q * 2.1 + 17.0, t * 0.030))',
      '          + 0.15 * noise(vec3(q * 4.3 + 41.0, t * 0.045));',
      '  float lo = 0.53 - 0.08 * u_breath;',          // breathing in: the clouds spread
      '  float cov = smoothstep(lo, lo + 0.36, n);',
      '  cov *= 0.75 + 0.5 * hash(vec3(cell, 3.0));',  // grain: no two dots quite alike
      '  float r = sqrt(clamp(cov, 0.0, 1.0)) * u_rmax;',
      // hard-edged pixels, like a 1-bit bitmap; tiny dots vanish instead of
      // leaving a faint grid behind
      '  float a = step(0.5, r) * step(length(px - center), r);',
      '  gl_FragColor = u_ink * a;',
      '}'
    ].join('\n');

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var prog, loc, ready = false;
    function setup() {
      var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var p = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(p);
      gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      loc = { h: gl.getUniformLocation(prog, 'u_h'), t: gl.getUniformLocation(prog, 'u_t'),
              breath: gl.getUniformLocation(prog, 'u_breath'), ink: gl.getUniformLocation(prog, 'u_ink') };
      gl.uniform1f(gl.getUniformLocation(prog, 'u_cell'), CELL);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_rmax'), RMAX);
      loc.cloud = gl.getUniformLocation(prog, 'u_cloud');
      // deep blue ink, a shade darker than the sheet (premultiplied)
      var A = 0.26;
      gl.uniform4f(loc.ink, 0.04 * A, 0.09 * A, 0.27 * A, A);
      return true;
    }

    // One bitmap pixel = PX screen points, scaled up without smoothing. Sized to
    // the whole screen so phone toolbars sliding away never resize it.
    var bw = 0, bh = 0;
    function size() {
      var w = Math.ceil(document.documentElement.clientWidth / PX);
      var h = Math.ceil(Math.max(window.innerHeight, screen.height || 0) / PX);
      if (w === bw && h === bh) return false;
      bw = w; bh = h;
      canvas.width = bw; canvas.height = bh;
      canvas.style.width = bw * PX + 'px';
      canvas.style.height = bh * PX + 'px';
      gl.viewport(0, 0, bw, bh);
      if (ready) { gl.uniform1f(loc.h, bh); gl.uniform1f(loc.cloud, cloud() / PX); }
      return true;
    }

    var BREATH = 9, start = performance.now(), last = 0, viewer = document.querySelector('.viewer');
    function draw(now) {
      var t = (now - start) / 1000 + 40;        // start mid-drift, not at the field's origin
      gl.uniform1f(loc.t, still ? 40 : t);
      gl.uniform1f(loc.breath, still ? 0.5 : 0.5 - 0.5 * Math.cos(2 * Math.PI * t / BREATH));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      if (!ready) return;
      requestAnimationFrame(frame);
      if (now - last < 66) return;               // 15 frames a second is plenty for a slow breath
      if (viewer && viewer.open) return;         // hidden behind the viewer anyway
      last = now;
      draw(now);
    }

    function begin() {
      ready = setup();
      if (!ready) { layer.remove(); return; }
      size();
      gl.uniform1f(loc.h, bh);
      gl.uniform1f(loc.cloud, cloud() / PX);
      draw(performance.now());
      requestAnimationFrame(function () { layer.classList.add('is-on'); });
      if (!still) requestAnimationFrame(frame);
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (ready && size()) draw(performance.now()); }, 150);
    });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); ready = false; layer.classList.remove('is-on'); });
    canvas.addEventListener('webglcontextrestored', function () { bw = bh = 0; begin(); });

    // Start after the page has loaded and settled, so it never competes
    // with the paintings for the first moments of a visit.
    function whenSettled(fn) {
      var go = function () {
        if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 300);
      };
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    }
    whenSettled(function () {
      document.body.insertBefore(layer, document.body.firstChild);  // beneath the sky and the sheet
      begin();
    });
  })();

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

  /* -- sharing: the phone's share sheet, or the link copied */

  var toast = viewer.querySelector('[data-toast]'), toastTimer = 0;
  function say(msg) {
    toast.textContent = msg;
    viewer.classList.add('has-toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { viewer.classList.remove('has-toast'); toast.textContent = ''; }, 2400);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      viewer.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { /* not allowed */ }
      ta.remove();
      if (ok) resolve(); else reject();
    });
  }
  function share() {
    var work = works[index];
    var url = location.origin + location.pathname + '#' + work.id;
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && touch) {
      navigator.share({ title: work.title + ' — ' + artist, url: url }).catch(function () {});
      return;
    }
    copyText(url).then(function () { say('Link copied'); }, function () { say(url); });
  }

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
    if (t.closest('[data-share]')) { share(); return; }
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
