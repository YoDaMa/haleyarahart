/* The viewer: one painting at a time, as large as the screen allows, under a
   lamp you hold. Zoom into the surface; browse with arrows, keys or swipes. */
(function (HA) {
  'use strict';
  var U = HA.util;
  var MAX_ZOOM = 3.5;

  function Viewer(root, works, opts) {
    this.root = root;
    this.works = works;
    this.o = opts || {};
    this.stage = root.querySelector('[data-stage]');
    this.img = root.querySelector('.viewer__img');
    this.canvas = root.querySelector('.viewer__canvas');
    this.el = {
      title: root.querySelector('[data-title]'),
      meta: root.querySelector('[data-meta]'),
      count: root.querySelector('[data-count]'),
      palette: root.querySelector('[data-palette]'),
      inquire: root.querySelector('[data-inquire]'),
      hint: root.querySelector('[data-hint]'),
      light: root.querySelector('[data-action="light"]'),
      zoom: root.querySelector('[data-action="zoom"]'),
      close: root.querySelector('[data-action="close"]')
    };
    this.index = -1;
    this.isOpen = false;
    this.fit = { x: 0, y: 0, w: 1, h: 1 };
    this.z = { s: 1, tx: 0, ty: 0 };
    this.lightOn = true;
    this.lamp = { x: 0.5, y: 0.2, tx: 0.5, ty: 0.2, hover: false, lastMove: 0 };
    this.amount = 0;
    this.spot = 0;
    this.focus = 0;
    this.pointers = new Map();
    this.relief = null;
    this.reliefFailed = !HA.Relief || !HA.Relief.supported();
    this.loop = this.loop.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onResize = this.onResize.bind(this);
    this.bindUI();
  }

  /* ------------------------------------------------------------ open/close */

  Viewer.prototype.open = function (i, fromEl) {
    if (this.isOpen) { this.show(i); return; }
    this.isOpen = true;
    this.lastFocus = document.activeElement;
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', sbw + 'px');
    document.documentElement.classList.add('is-locked');
    this.root.hidden = false;
    void this.root.offsetWidth; // let the fade start from 0
    this.root.classList.add('is-open');
    document.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.show(i, fromEl);
    this.el.close.focus({ preventScroll: true });
    this.showHint();
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  };

  Viewer.prototype.close = function () {
    if (!this.isOpen) return;
    var self = this;
    this.isOpen = false;
    this.running = false;
    this.root.classList.remove('is-open');
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.hintTimer);
    setTimeout(function () {
      if (self.isOpen) return;
      self.root.hidden = true;
      self.canvas.classList.remove('is-ready');
      document.documentElement.classList.remove('is-locked');
      if (self.lastFocus && self.lastFocus.focus) self.lastFocus.focus({ preventScroll: true });
    }, U.reducedMotion() ? 0 : 450);
    if (this.o.onClose) this.o.onClose();
  };

  Viewer.prototype.step = function (dir) {
    var n = this.works.length;
    this.show((this.index + dir + n) % n);
  };

  Viewer.prototype.show = function (i, fromEl) {
    var self = this, w = this.works[i];
    if (!w) return;
    var changed = i !== this.index;
    this.index = i;
    this.el.title.textContent = w.title;
    this.el.meta.textContent = w.meta;
    this.el.count.textContent = pad(i + 1) + ' / ' + pad(this.works.length);
    if (w.inquire) {
      this.el.inquire.href = w.inquire;
      this.el.inquire.hidden = false;
    } else {
      this.el.inquire.hidden = true;
    }
    this.el.palette.textContent = '';
    if (w.palette && HA.palette) {
      w.palette().then(function (colors) {
        if (self.index === i && colors) HA.palette.render(self.el.palette, colors);
      });
    }
    if (changed && this.o.onChange) this.o.onChange(i);

    this.natural = { w: w.w, h: w.h };
    this.z = { s: 1, tx: 0, ty: 0 };
    this.syncZoomUI();
    this.canvas.classList.remove('is-ready');
    if (this.img.getAttribute('src') !== w.src) this.img.src = w.src;
    this.img.alt = w.alt || '';
    this.layout();

    var flip = fromEl ? this.flip(fromEl) : Promise.resolve();
    var ready = U.whenLoaded(this.img).then(function () {
      if (self.index !== i) return false;
      self.natural = { w: self.img.naturalWidth, h: self.img.naturalHeight };
      self.layout();
      return self.prepareRelief();
    }).catch(function () { return false; });

    Promise.all([flip, ready]).then(function (res) {
      if (self.index !== i || !self.isOpen || !res[1]) return;
      self.amount = 0;
      self.lamp.x = self.lamp.tx = 0.15 * self.fit.w / self.fit.h;
      self.lamp.y = self.lamp.ty = -0.1;
      self.dirty = true;
      self.render();
      self.canvas.classList.add('is-ready');
    });
  };

  /* Fly the painting from its place on the page into the viewer. */
  Viewer.prototype.flip = function (fromEl) {
    if (U.reducedMotion() || !this.img.animate) return Promise.resolve();
    var a = fromEl.getBoundingClientRect(), b = this.fit;
    if (!a.width || !b.w) return Promise.resolve();
    var anim = this.img.animate([
      { transform: 'translate(' + (a.left - b.x) + 'px,' + (a.top - b.y) + 'px) scale(' + (a.width / b.w) + ',' + (a.height / b.h) + ')' },
      { transform: 'translate(0,0) scale(1,1)' }
    ], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    return anim.finished.catch(function () {});
  };

  Viewer.prototype.prepareRelief = function () {
    if (this.reliefFailed) return false;
    try {
      if (!this.relief) {
        var self = this;
        this.relief = new HA.Relief(this.canvas, this.img, {
          fullRes: true,
          onLost: function () { self.canvas.classList.remove('is-ready'); },
          onRestored: function () { self.canvas.classList.add('is-ready'); }
        });
      }
      this.relief.setImage(this.img);
      this.applyRect();
      return true;
    } catch (err) {
      console.warn('[viewer] showing the plain photo:', err);
      this.reliefFailed = true;
      if (this.relief) { this.relief.destroy(); this.relief = null; }
      return false;
    }
  };

  /* ---------------------------------------------------------------- layout */

  Viewer.prototype.layout = function () {
    var vw = this.stage.clientWidth, vh = this.stage.clientHeight;
    var mobile = vw < 700;
    var padX = mobile ? 12 : Math.max(100, vw * 0.075);
    var top = mobile ? 64 : 78, bottom = mobile ? 156 : 112;
    var aw = Math.max(50, vw - padX * 2), ah = Math.max(50, vh - top - bottom);
    var ar = (this.natural.w || 4) / (this.natural.h || 5);
    var w = Math.min(aw, ah * ar), h = w / ar;
    this.fit = { x: (vw - w) / 2, y: top + (ah - h) / 2, w: w, h: h };
    this.applyRect();
  };

  Viewer.prototype.rect = function () {
    var f = this.fit, z = this.z;
    return { x: f.x + z.tx, y: f.y + z.ty, w: f.w * z.s, h: f.h * z.s };
  };

  Viewer.prototype.applyRect = function () {
    var r = this.rect();
    var s = this.img.style;
    s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
    if (this.relief) {
      this.relief.rect = r;
      this.relief.resize();
      this.dirty = true;
    }
  };

  Viewer.prototype.clampPan = function () {
    var f = this.fit, z = this.z;
    var w = f.w * z.s, h = f.h * z.s;
    // keep the fit area covered by the painting while zoomed
    z.tx = Math.min(0, Math.max(f.w - w, z.tx));
    z.ty = Math.min(0, Math.max(f.h - h, z.ty));
  };

  /* Zoom to scale s, keeping the painting point under (cx, cy) in place. */
  Viewer.prototype.zoomTo = function (s, cx, cy, animate) {
    s = Math.max(1, Math.min(MAX_ZOOM, s));
    var r = this.rect();
    if (cx == null) { cx = this.fit.x + this.fit.w / 2; cy = this.fit.y + this.fit.h / 2; }
    var u = (cx - r.x) / r.w, v = (cy - r.y) / r.h;
    var z = this.z;
    var from = { s: z.s, tx: z.tx, ty: z.ty };
    z.s = s;
    z.tx = cx - u * this.fit.w * s - this.fit.x;
    z.ty = cy - v * this.fit.h * s - this.fit.y;
    this.clampPan();
    this.syncZoomUI();
    if (animate && !U.reducedMotion()) {
      this.tween = { from: from, to: { s: z.s, tx: z.tx, ty: z.ty }, t0: performance.now(), dur: 520 };
      z.s = from.s; z.tx = from.tx; z.ty = from.ty;
    } else {
      this.tween = null;
      this.applyRect();
    }
  };

  Viewer.prototype.syncZoomUI = function () {
    var zoomed = this.z.s > 1.01 || (this.tween && this.tween.to.s > 1.01);
    this.root.classList.toggle('is-zoomed', !!zoomed);
    this.el.zoom.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
    this.el.zoom.textContent = zoomed ? 'Fit' : 'Zoom';
  };

  Viewer.prototype.onResize = function () {
    this.z = { s: 1, tx: 0, ty: 0 };
    this.tween = null;
    this.syncZoomUI();
    this.layout();
  };

  /* ------------------------------------------------------------- the lamp */

  Viewer.prototype.loop = function (now) {
    if (!this.running) return;
    var dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    var f = dt * 60;

    if (this.tween) {
      var tw = this.tween, k = Math.min(1, (now - tw.t0) / tw.dur);
      var e = 1 - Math.pow(1 - k, 4);
      this.z.s = tw.from.s + (tw.to.s - tw.from.s) * e;
      this.z.tx = tw.from.tx + (tw.to.tx - tw.from.tx) * e;
      this.z.ty = tw.from.ty + (tw.to.ty - tw.from.ty) * e;
      this.applyRect();
      if (k >= 1) { this.tween = null; this.syncZoomUI(); }
    }

    var lamp = this.lamp, r = this.rect();
    var idle = !lamp.hover && now - lamp.lastMove > 2500;
    if (idle) {
      // without a hand on it, the lamp drifts slowly across the top of the work
      var w = now / 1000, aspect = r.w / r.h;
      lamp.tx = aspect * (0.5 + Math.cos(w * 0.3) * 0.45);
      lamp.ty = 0.32 + Math.sin(w * 0.41) * 0.38;
    }
    var follow = 1 - Math.pow(1 - (idle ? 0.04 : 0.2), f);
    var targetAmount = this.lightOn ? 1 : 0;
    var targetSpot = lamp.hover ? 0.5 : 0;
    var targetFocus = lamp.hover ? 1 : 0;
    if (Math.abs(targetFocus - this.focus) > 0.002) {
      this.focus += (targetFocus - this.focus) * (1 - Math.pow(1 - 0.08, f));
      this.dirty = true;
    }
    var changed = this.dirty;
    if (Math.abs(lamp.tx - lamp.x) + Math.abs(lamp.ty - lamp.y) > 0.0005) {
      lamp.x += (lamp.tx - lamp.x) * follow;
      lamp.y += (lamp.ty - lamp.y) * follow;
      changed = true;
    }
    if (Math.abs(targetAmount - this.amount) > 0.002) {
      this.amount += (targetAmount - this.amount) * (1 - Math.pow(1 - 0.1, f));
      changed = true;
    } else this.amount = targetAmount;
    if (Math.abs(targetSpot - this.spot) > 0.002) {
      this.spot += (targetSpot - this.spot) * (1 - Math.pow(1 - 0.08, f));
      changed = true;
    }
    if (changed) this.render();
    requestAnimationFrame(this.loop);
  };

  Viewer.prototype.render = function () {
    var rel = this.relief;
    if (!rel || !rel.ok) return;
    var p = rel.p;
    p.lx = this.lamp.x;
    p.ly = this.lamp.y;
    p.lz = 0.3;
    p.amount = this.amount;
    // untouched it stays true to the photo; under the hand, the full relief —
    // eased off when zoomed, where the photo's own grain is magnified too
    var zf = 0.55 + 0.45 / this.z.s;
    p.bump = 3.2 + 0.8 * this.focus;
    p.spec = (0.3 + 0.6 * this.focus) * zf;
    p.spot = this.spot;
    p.relief = (0.2 + 0.8 * this.focus) * zf;
    p.focus = 6 * this.focus * Math.sqrt(this.z.s);
    p.floor = 1 - 0.85 * this.focus;
    rel.render();
    this.dirty = false;
  };

  /* ------------------------------------------------------------------ input */

  Viewer.prototype.bindUI = function () {
    var self = this, stage = this.stage;

    this.root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var a = btn.getAttribute('data-action');
      if (a === 'close') self.close();
      else if (a === 'prev') self.step(-1);
      else if (a === 'next') self.step(1);
      else if (a === 'light') self.toggleLight();
      else if (a === 'zoom') self.zoomTo(self.z.s > 1.01 ? 1 : 2.4, null, null, true);
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var k = e.ctrlKey ? 0.012 : 0.0018; // trackpad pinch arrives as ctrl+wheel
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      self.zoomTo(self.z.s * Math.exp(-dy * k), e.clientX, e.clientY, false);
      self.hideHint();
    }, { passive: false });

    stage.addEventListener('dblclick', function (e) {
      self.zoomTo(self.z.s > 1.01 ? 1 : 2.4, e.clientX, e.clientY, true);
    });

    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      stage.setPointerCapture(e.pointerId);
      self.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), type: e.pointerType });
      if (self.pointers.size === 2) self.startPinch();
      if (e.pointerType !== 'mouse') self.moveLamp(e.clientX, e.clientY, true);
      self.hideHint();
    });

    stage.addEventListener('pointermove', function (e) {
      var pt = self.pointers.get(e.pointerId);
      if (e.pointerType === 'mouse') self.moveLamp(e.clientX, e.clientY, true);
      if (!pt) return;
      var dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;
      if (self.pointers.size === 2 && self.pinch) {
        self.updatePinch();
      } else if (self.z.s > 1.01) {
        self.z.tx += dx; self.z.ty += dy;
        self.clampPan();
        self.applyRect();
        self.root.classList.add('is-panning');
      } else if (e.pointerType !== 'mouse') {
        self.moveLamp(e.clientX, e.clientY, true);
      }
    });

    function end(e) {
      var pt = self.pointers.get(e.pointerId);
      if (!pt) return;
      self.pointers.delete(e.pointerId);
      self.root.classList.remove('is-panning');
      if (self.pointers.size < 2) self.pinch = null;
      if (e.type === 'pointercancel') return;
      // a quick horizontal swipe on an unzoomed painting browses
      var dx = e.clientX - pt.x0, dy = e.clientY - pt.y0, dt = performance.now() - pt.t0;
      if (pt.type !== 'mouse' && self.z.s <= 1.01 && !self.wasPinching && dt < 450 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        self.step(dx < 0 ? 1 : -1);
      }
      if (self.pointers.size === 0) self.wasPinching = false;
      if (pt.type !== 'mouse') self.lamp.hover = false;
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') self.lamp.hover = false;
    });
  };

  Viewer.prototype.moveLamp = function (cx, cy, hover) {
    if (!this.relief) return;
    var s = this.relief.surfacePoint(cx, cy);
    this.lamp.tx = s.x;
    this.lamp.ty = s.y;
    this.lamp.hover = hover;
    this.lamp.lastMove = performance.now();
  };

  Viewer.prototype.startPinch = function () {
    var pts = Array.from(this.pointers.values());
    var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
    var r = this.rect();
    this.pinch = {
      d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      s0: this.z.s,
      u: (mx - r.x) / r.w,
      v: (my - r.y) / r.h
    };
    this.wasPinching = true;
    this.tween = null;
  };

  Viewer.prototype.updatePinch = function () {
    var pts = Array.from(this.pointers.values()), p = this.pinch;
    var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
    var s = Math.max(1, Math.min(MAX_ZOOM, p.s0 * d / p.d0));
    this.z.s = s;
    this.z.tx = mx - p.u * this.fit.w * s - this.fit.x;
    this.z.ty = my - p.v * this.fit.h * s - this.fit.y;
    this.clampPan();
    this.syncZoomUI();
    this.applyRect();
  };

  Viewer.prototype.toggleLight = function () {
    this.lightOn = !this.lightOn;
    this.el.light.setAttribute('aria-pressed', this.lightOn ? 'true' : 'false');
  };

  Viewer.prototype.onKey = function (e) {
    if (e.defaultPrevented || e.altKey || e.metaKey) return;
    switch (e.key) {
      case 'Escape': e.preventDefault(); this.close(); break;
      case 'ArrowLeft': e.preventDefault(); this.step(-1); break;
      case 'ArrowRight': e.preventDefault(); this.step(1); break;
      case '+': case '=': e.preventDefault(); this.zoomTo(this.z.s * 1.4, null, null, true); break;
      case '-': case '_': e.preventDefault(); this.zoomTo(this.z.s / 1.4, null, null, true); break;
      case '0': e.preventDefault(); this.zoomTo(1, null, null, true); break;
      case 'l': case 'L': if (!e.ctrlKey) { e.preventDefault(); this.toggleLight(); } break;
      case 'Tab': this.trapFocus(e); break;
    }
  };

  Viewer.prototype.trapFocus = function (e) {
    var els = Array.prototype.filter.call(
      this.root.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.hidden && el.offsetParent !== null; }
    );
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!this.root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  };

  Viewer.prototype.showHint = function () {
    var self = this, key = 'ha-viewer-hint';
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
    this.el.hint.classList.add('is-visible');
    this.hintTimer = setTimeout(function () { self.hideHint(); }, 4800);
  };
  Viewer.prototype.hideHint = function () {
    this.el.hint.classList.remove('is-visible');
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  HA.Viewer = Viewer;
})(window.HA = window.HA || {});
