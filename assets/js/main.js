/* Small live details (date, time, counts) and the full-screen viewer.
   Without JavaScript the page still reads fine and each painting opens as
   a plain image. */
(function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }

  /* ----------------------------------------------------------- the sheet */

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  var pieces = document.querySelectorAll('.piece');
  each('[data-works]', function (el) { el.textContent = pad(pieces.length); });
  each('[data-fig-range]', function (el) { el.textContent = '01–' + pad(pieces.length); });

  function tick() {
    var now = new Date();
    var date = pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + String(now.getFullYear()).slice(-2);
    var hh = pad(now.getHours()), mm = pad(now.getMinutes());
    each('[data-date]', function (el) { el.textContent = date; el.dateTime = now.toISOString().slice(0, 10); });
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

  var viewer = document.querySelector('.viewer');
  var links = Array.prototype.slice.call(document.querySelectorAll('.piece__link'));
  if (!viewer || typeof viewer.showModal !== 'function' || !links.length) return;

  var img = viewer.querySelector('[data-img]');
  var stage = viewer.querySelector('[data-stage]');
  var title = viewer.querySelector('[data-title]');
  var meta = viewer.querySelector('[data-meta]');
  var count = viewer.querySelector('[data-count]');
  var index = 0;

  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var works = links.map(function (link) {
    var piece = link.closest('.piece');
    var thumb = link.querySelector('img');
    return {
      src: link.getAttribute('href'),
      alt: thumb ? thumb.alt : '',
      title: text(piece.querySelector('.piece__title')),
      meta: text(piece.querySelector('.piece__meta'))
    };
  });

  function show(i) {
    index = (i + works.length) % works.length;
    var work = works[index];
    img.src = work.src;
    img.alt = work.alt;
    title.textContent = work.title;
    meta.textContent = work.meta;
    count.textContent = 'Fig. ' + pad(index + 1) + ' / ' + pad(works.length);
    new Image().src = works[(index + 1) % works.length].src; // have the next one ready
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      show(i);
      viewer.showModal();
    });
  });

  viewer.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-close]') || t === stage) viewer.close();
    else if (t.closest('[data-prev]')) show(index - 1);
    else if (t.closest('[data-next]')) show(index + 1);
  });

  viewer.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  });

  // Swipe between paintings on touch screens
  var startX = null, startY = 0;
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
  });
  stage.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', function () { startX = null; });
})();
