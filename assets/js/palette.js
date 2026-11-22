/* Measure a painting's palette from its photo.
   k-means in OKLab (hue separation emphasised), each cluster represented by
   its more saturated half so the chips read like paint, not like an average. */
(function (HA) {
  'use strict';
  var U = HA.util;
  var cache = new Map();

  function pixels(img, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data; // throws if the image is cross-origin
  }

  function extract(img, k) {
    k = k || 7;
    var key = img.currentSrc || img.src;
    if (cache.has(key)) return cache.get(key);

    var data = pixels(img, 90);
    var n = data.length / 4;
    var rgb = new Float32Array(n * 3);
    var lab = new Float32Array(n * 3);
    var chroma = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      var o = U.oklab(r, g, b);
      rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
      lab[i * 3] = o[0]; lab[i * 3 + 1] = o[1] * 2.2; lab[i * 3 + 2] = o[2] * 2.2;
      chroma[i] = Math.hypot(o[1], o[2]);
    }

    // k-means++ seeding with a fixed seed: same painting, same palette.
    var rand = U.rng(7);
    var C = new Float32Array(k * 3);
    var first = Math.floor(rand() * n);
    C[0] = lab[first * 3]; C[1] = lab[first * 3 + 1]; C[2] = lab[first * 3 + 2];
    var d2 = new Float32Array(n);
    for (var c = 1; c < k; c++) {
      var sum = 0;
      for (i = 0; i < n; i++) {
        var best = Infinity;
        for (var j = 0; j < c; j++) {
          var dx = lab[i * 3] - C[j * 3], dy = lab[i * 3 + 1] - C[j * 3 + 1], dz = lab[i * 3 + 2] - C[j * 3 + 2];
          var d = dx * dx + dy * dy + dz * dz;
          if (d < best) best = d;
        }
        d2[i] = best; sum += best;
      }
      var target = rand() * sum, acc = 0, pick = n - 1;
      for (i = 0; i < n; i++) { acc += d2[i]; if (acc >= target) { pick = i; break; } }
      C[c * 3] = lab[pick * 3]; C[c * 3 + 1] = lab[pick * 3 + 1]; C[c * 3 + 2] = lab[pick * 3 + 2];
    }

    var label = new Uint8Array(n);
    for (var it = 0; it < 14; it++) {
      var S = new Float32Array(k * 3), cnt = new Float32Array(k);
      for (i = 0; i < n; i++) {
        var bi = 0, bd = Infinity;
        for (j = 0; j < k; j++) {
          var ex = lab[i * 3] - C[j * 3], ey = lab[i * 3 + 1] - C[j * 3 + 1], ez = lab[i * 3 + 2] - C[j * 3 + 2];
          var dd = ex * ex + ey * ey + ez * ez;
          if (dd < bd) { bd = dd; bi = j; }
        }
        label[i] = bi;
        S[bi * 3] += lab[i * 3]; S[bi * 3 + 1] += lab[i * 3 + 1]; S[bi * 3 + 2] += lab[i * 3 + 2];
        cnt[bi]++;
      }
      for (j = 0; j < k; j++) {
        if (!cnt[j]) continue;
        C[j * 3] = S[j * 3] / cnt[j]; C[j * 3 + 1] = S[j * 3 + 1] / cnt[j]; C[j * 3 + 2] = S[j * 3 + 2] / cnt[j];
      }
    }

    var out = [];
    for (j = 0; j < k; j++) {
      var members = [];
      for (i = 0; i < n; i++) if (label[i] === j) members.push(i);
      if (!members.length) continue;
      members.sort(function (a, b) { return chroma[b] - chroma[a]; });
      var half = members.slice(0, Math.max(1, Math.ceil(members.length / 2)));
      var sr = 0, sg = 0, sb = 0;
      half.forEach(function (m) { sr += rgb[m * 3]; sg += rgb[m * 3 + 1]; sb += rgb[m * 3 + 2]; });
      var col = [sr / half.length, sg / half.length, sb / half.length];
      out.push({ hex: U.hex(col), rgb: col, share: members.length / n, L: C[j * 3] });
    }
    // Order dark to light, like paint laid out on a palette.
    out.sort(function (a, b) { return a.L - b.L; });
    cache.set(key, out);
    return out;
  }

  /* Render chips into a container. */
  function render(container, colors) {
    container.textContent = '';
    colors.forEach(function (c) {
      var chip = document.createElement('span');
      chip.className = 'palette__chip';
      chip.style.setProperty('--c', c.hex);
      chip.style.setProperty('--p', (c.share * 100).toFixed(2));
      chip.title = c.hex.toUpperCase();
      container.appendChild(chip);
    });
  }

  HA.palette = { extract: extract, render: render };
})(window.HA = window.HA || {});
