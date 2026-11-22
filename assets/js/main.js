/* Wires the page together: works, light, viewer, navigation and reveals.
   All content lives in index.html — this file only enhances it. */
(function (HA) {
  'use strict';
  var U = HA.util;
  var root = document.documentElement;
  var reduce = U.reducedMotion();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ------------------------------------------------------------ the works */

  function contactEmail() {
    var a = document.querySelector('[data-email]');
    if (!a) return '';
    return (a.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0];
  }

  function mailto(email, title) {
    return 'mailto:' + email + '?subject=' + encodeURIComponent('Inquiry: ' + title);
  }

  function link(href, label, arrow) {
    var a = document.createElement('a');
    a.className = 'link';
    a.href = href;
    a.textContent = label;
    if (arrow) {
      var s = document.createElement('span');
      s.className = 'arrow';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = arrow;
      a.appendChild(s);
    }
    return a;
  }

  function setAspect(el, img, crop) {
    var apply = function (w, h) {
      if (!w || !h) return;
      var cw = crop ? crop[2] : 1, ch = crop ? crop[3] : 1;
      el.style.setProperty('--ar', (w * cw).toFixed(2) + ' / ' + (h * ch).toFixed(2));
    };
    apply(+img.getAttribute('width'), +img.getAttribute('height'));
    U.whenLoaded(img).then(function () { apply(img.naturalWidth, img.naturalHeight); }).catch(function () {});
  }

  function enhanceWorks() {
    var articles = Array.prototype.slice.call(document.querySelectorAll('.work'));
    var email = contactEmail();
    return articles.map(function (art, i) {
      var img = art.querySelector('.work__img');
      var figure = art.querySelector('.work__figure');
      var label = art.querySelector('.work__label');
      var title = text(art.querySelector('.work__title')) || 'Untitled';
      var meta = Array.prototype.map.call(art.querySelectorAll('.work__meta'), text).join(' · ');
      var id = art.id || ('work-' + (i + 1));
      art.id = id;

      var frame = document.createElement('a');
      frame.className = 'work__frame';
      frame.href = '#view/' + id;
      frame.setAttribute('aria-label', 'View ' + title + ' larger');
      figure.insertBefore(frame, img);
      frame.appendChild(img);
      var canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      frame.appendChild(canvas);
      setAspect(frame, img);

      var index = document.createElement('p');
      index.className = 'work__index mono';
      index.textContent = pad(i + 1) + ' / ' + pad(articles.length);
      label.insertBefore(index, label.firstChild);

      var pal = document.createElement('div');
      pal.className = 'palette';
      pal.setAttribute('aria-hidden', 'true');
      label.appendChild(pal);

      var actions = document.createElement('div');
      actions.className = 'work__actions';
      actions.appendChild(link('#view/' + id, 'View', '→'));
      if (email) actions.appendChild(link(mailto(email, title), 'Inquire'));
      label.appendChild(actions);

      var paletteP = null;
      var palette = function () {
        if (!paletteP) {
          paletteP = U.whenLoaded(img).then(function () {
            try { return HA.palette.extract(img, 7); } catch (e) { return null; }
          }).catch(function () { return null; });
        }
        return paletteP;
      };
      palette().then(function (colors) {
        if (colors) HA.palette.render(pal, colors); else pal.remove();
      });

      return {
        id: id, el: art, frame: frame, img: img, canvas: canvas,
        title: title, meta: meta, alt: img.alt,
        src: img.getAttribute('src'),
        w: +img.getAttribute('width') || img.naturalWidth || 4,
        h: +img.getAttribute('height') || img.naturalHeight || 5,
        inquire: email ? mailto(email, title) : '',
        palette: palette
      };
    });
  }

  /* --------------------------------------------- raking light on the page */
  /* Each painting on the page is relit continuously: as you scroll past, the
     lamp slides across the top edge like walking past a painting in a room;
     hover, and the lamp is in your hand. */

  function Lights() {
    this.items = [];
    this.running = false;
    this.mouse = { x: 0, y: 0 };
    this.tick = this.tick.bind(this);
    this.supported = !!(HA.Relief && HA.Relief.supported());
    var self = this;
    window.addEventListener('scroll', function () { self.kick(); }, { passive: true });
    window.addEventListener('resize', function () {
      self.items.forEach(function (it) { if (it.relief) { it.relief.resize(); it.dirty = true; } });
      self.kick();
    });
  }

  Lights.prototype.add = function (frame, img, canvas, crop) {
    if (!this.supported) return;
    var self = this;
    var it = {
      frame: frame, img: img, canvas: canvas, crop: crop || [0, 0, 1, 1],
      relief: null, near: false, hover: false, failed: false, dirty: true,
      lamp: { x: 0.5, y: -0.3, z: 0.7 }, amount: 0, spot: 0, spec: 0.32, bump: 3, relief: 0.2, focus: 0, floor: 1,
      cx: 0, cy: 0
    };
    this.items.push(it);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        it.near = entries[0].isIntersecting;
        if (it.near) self.ensure(it);
        self.kick();
      }, { rootMargin: '35% 0px' }).observe(frame);
    }

    if (U.finePointer()) {
      frame.addEventListener('pointermove', function (e) {
        it.hover = true; it.cx = e.clientX; it.cy = e.clientY;
        self.kick();
      }, { passive: true });
      frame.addEventListener('pointerleave', function () { it.hover = false; self.kick(); });
    }
  };

  Lights.prototype.ensure = function (it) {
    if (it.relief || it.failed) return;
    var self = this;
    U.whenLoaded(it.img).then(function () {
      if (it.relief || it.failed) return;
      try {
        it.relief = new HA.Relief(it.canvas, it.img, {
          crop: it.crop,
          onLost: function () { it.canvas.classList.remove('is-ready'); },
          onRestored: function () { it.canvas.classList.add('is-ready'); }
        });
        it.relief.resize(true);
        it.dirty = true;
        self.kick();
        self.prune();
      } catch (err) {
        console.warn('[light] showing the plain photo:', err);
        it.failed = true;
        if (it.relief) it.relief.destroy();
        it.relief = null;
      }
    }).catch(function () { it.failed = true; });
  };

  /* Browsers cap live WebGL contexts; let go of the ones far off screen. */
  Lights.prototype.prune = function () {
    var live = this.items.filter(function (it) { return it.relief; });
    if (live.length <= 6) return;
    var vh = window.innerHeight;
    live.sort(function (a, b) {
      var ra = a.frame.getBoundingClientRect(), rb = b.frame.getBoundingClientRect();
      return Math.abs(rb.top + rb.height / 2 - vh / 2) - Math.abs(ra.top + ra.height / 2 - vh / 2);
    });
    live.slice(0, live.length - 6).forEach(function (it) {
      if (it.near) return;
      it.relief.destroy();
      it.relief = null;
      it.canvas.classList.remove('is-ready');
    });
  };

  Lights.prototype.kick = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  };

  Lights.prototype.tick = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    var f = dt * 60, vh = window.innerHeight, busy = false;

    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], rel = it.relief;
      if (!rel || !rel.ok || !it.near) continue;
      var r = it.frame.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      var aspect = r.width / r.height;
      var revealed = !it.frame.closest('.work') || it.frame.closest('.work').classList.contains('is-in') || !root.classList.contains('reveal-ready');
      var t;
      if (it.hover) {
        // the lamp in your hand: strong raking light, pooled around the cursor
        var s = rel.surfacePoint(it.cx, it.cy);
        t = { x: s.x, y: s.y, z: 0.24, amount: 1, spot: 0.5, spec: 0.9, bump: 4, relief: 1, focus: 7, floor: 0.12 };
      } else {
        // at rest the photo stays true; only a few glints travel across the
        // surface as you scroll past, like walking by a painting in a room
        var prog = clamp((vh - r.top) / (vh + r.height), 0, 1);
        t = { x: aspect * (-0.15 + 1.3 * prog), y: -0.32, z: 0.7, amount: revealed ? 1 : 0, spot: 0, spec: 0.32, bump: 3, relief: 0.2, focus: 0, floor: 1 };
      }
      var k = reduce ? 1 : 1 - Math.pow(1 - (it.hover ? 0.22 : 0.12), f);
      var ka = reduce ? 1 : 1 - Math.pow(1 - 0.06, f);
      var dl = Math.abs(t.x - it.lamp.x) + Math.abs(t.y - it.lamp.y) + Math.abs(t.z - it.lamp.z);
      var da = Math.abs(t.amount - it.amount) + Math.abs(t.spot - it.spot) + Math.abs(t.spec - it.spec) +
        Math.abs(t.relief - it.relief) + Math.abs(t.floor - it.floor) + (Math.abs(t.bump - it.bump) + Math.abs(t.focus - it.focus)) * 0.05;
      if (dl > 0.0008 || da > 0.002 || it.dirty) {
        it.lamp.x += (t.x - it.lamp.x) * k;
        it.lamp.y += (t.y - it.lamp.y) * k;
        it.lamp.z += (t.z - it.lamp.z) * k;
        it.amount += (t.amount - it.amount) * ka;
        it.spot += (t.spot - it.spot) * k;
        it.spec += (t.spec - it.spec) * k;
        it.bump += (t.bump - it.bump) * k;
        it.relief += (t.relief - it.relief) * k;
        it.focus += (t.focus - it.focus) * k;
        it.floor += (t.floor - it.floor) * k;
        var p = rel.p;
        p.lx = it.lamp.x; p.ly = it.lamp.y; p.lz = it.lamp.z;
        p.amount = it.amount; p.spot = it.spot; p.spec = it.spec; p.bump = it.bump;
        p.relief = it.relief; p.focus = it.focus; p.floor = it.floor;
        rel.render();
        if (!it.canvas.classList.contains('is-ready')) it.canvas.classList.add('is-ready');
        it.dirty = false;
        busy = true;
      }
    }
    if (busy) requestAnimationFrame(this.tick);
    else this.running = false;
  };

  /* -------------------------------------------------------- About: detail */

  function initDetail(lights) {
    var frame = document.querySelector('.detail__frame');
    if (!frame) return;
    var img = frame.querySelector('img');
    var crop = (frame.getAttribute('data-crop') || '').trim().split(/\s+/).map(Number);
    if (crop.length !== 4 || crop.some(isNaN)) crop = null;
    var inset = document.querySelector('.detail__inset');
    if (crop) {
      var vars = { '--cx': crop[0], '--cy': crop[1], '--cw': crop[2], '--ch': crop[3] };
      Object.keys(vars).forEach(function (k) {
        frame.style.setProperty(k, vars[k]);
        if (inset) inset.style.setProperty(k, vars[k]);
      });
      frame.classList.add('is-cropped');
    }
    setAspect(frame, img, crop);
    if (inset) {
      var iw = +img.getAttribute('width'), ih = +img.getAttribute('height');
      if (iw && ih) inset.style.setProperty('--iar', iw + ' / ' + ih);
    }
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    frame.appendChild(canvas);
    lights.add(frame, img, canvas, crop);
  }

  /* --------------------------------------------------------------- hero */

  function initHero(works) {
    var section = document.querySelector('.hero');
    if (!section) return;
    requestAnimationFrame(function () { section.classList.add('is-ready'); });
    if (!HA.Hero || !root.classList.contains('gl2')) return;
    var urls = works.map(function (w) { return w.src; });
    new HA.Hero(section).init(urls).then(function (ok) {
      if (!ok) root.classList.remove('gl2');
    }, function () { root.classList.remove('gl2'); });
  }

  /* ------------------------------------------------------------- viewer */

  function initViewer(works) {
    var el = document.getElementById('viewer');
    if (!el || !HA.Viewer || !works.length) return;

    function idFromHash() {
      var m = location.hash.match(/^#view\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    }
    function indexOf(id) {
      for (var i = 0; i < works.length; i++) if (works[i].id === id) return i;
      return -1;
    }

    var viewer = new HA.Viewer(el, works, {
      onChange: function (i) {
        if (viewer.isOpen && idFromHash() !== works[i].id) {
          history.replaceState(history.state, '', '#view/' + works[i].id);
        }
      },
      onClose: function () {
        if (!idFromHash()) return; // closed by the back button
        if (history.state && history.state.view) history.back();
        else history.replaceState(null, '', location.pathname + location.search);
      }
    });

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#view/"]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var id = decodeURIComponent(a.getAttribute('href').slice(6));
      var i = indexOf(id);
      if (i < 0) return;
      e.preventDefault();
      history.pushState({ view: id }, '', '#view/' + id);
      viewer.open(i, works[i].frame);
    });

    window.addEventListener('hashchange', function () {
      var i = indexOf(idFromHash());
      if (i >= 0) viewer.open(i, null);
      else if (viewer.isOpen) viewer.close();
    });

    var initial = indexOf(idFromHash());
    if (initial >= 0) viewer.open(initial, null);
  }

  /* ---------------------------------------------------------------- nav */

  function initNav() {
    var nav = document.querySelector('[data-nav]');
    if (!nav) return;
    var lastY = window.scrollY, ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 12);
      if (!root.classList.contains('is-locked')) {
        var down = y > lastY + 4, up = y < lastY - 4;
        if (down && y > window.innerHeight * 0.6) nav.classList.add('is-hidden');
        else if (up || y < 80) nav.classList.remove('is-hidden');
      }
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
    update();

    var links = Array.prototype.slice.call(nav.querySelectorAll('[data-nav-link]'));
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (l) {
      var s = document.querySelector(l.getAttribute('href'));
      if (s) io.observe(s);
    });
    var hero = document.querySelector('.hero');
    if (hero) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) links.forEach(function (l) { l.classList.remove('is-active'); });
      }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
    }
  }

  /* ------------------------------------------------------------ reveals */

  function initReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal], .work'));
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    root.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* --------------------------------------------------------------- lamp */

  function initLamp() {
    var lamp = document.querySelector('.lamp');
    if (!lamp || !U.finePointer()) return;
    var x = 0, y = 0, tx = 0, ty = 0, on = false, raf = 0;
    function step() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      lamp.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!on) { x = tx; y = ty; on = true; root.classList.add('has-lamp'); }
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () {
      on = false;
      root.classList.remove('has-lamp');
    });
  }

  /* -------------------------------------------------------------- grain */

  function initGrain() {
    try {
      var S = 180, c = document.createElement('canvas');
      c.width = c.height = S;
      var ctx = c.getContext('2d');
      var d = ctx.createImageData(S, S), rand = U.rng(3);
      for (var i = 0; i < d.data.length; i += 4) {
        var v = rand();
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v > 0.5 ? 255 : 0;
        d.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255);
      }
      ctx.putImageData(d, 0, 0);
      root.style.setProperty('--grain', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) { /* no grain, no problem */ }
  }

  /* --------------------------------------------------------------- init */

  function init() {
    if (!(HA.Relief && HA.Relief.supported())) root.classList.add('no-gl');
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
    initGrain();
    var works = enhanceWorks();
    var lights = new Lights();
    works.forEach(function (w) { lights.add(w.frame, w.img, w.canvas); });
    initDetail(lights);
    initHero(works);
    initViewer(works);
    initNav();
    initReveals();
    initLamp();
  }

  init();
})(window.HA = window.HA || {});
