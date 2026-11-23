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
    var time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    each('[data-date]', function (el) { el.textContent = date; el.dateTime = now.toISOString().slice(0, 10); });
    each('[data-time]', function (el) { el.textContent = time; });
  }
  tick();
  setTimeout(function () { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000);

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
