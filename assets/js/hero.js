/* The name, in relief.
   One continuous skin of paint — crumpled ridges and folds like the surface
   of the paintings, colored in patches sampled from them — out of which the
   name rises as a plateau of pale paint. The surface is baked once into
   textures (color, slope, crevice depth); every frame only the light moves.
   Mostly it sits in shadow: the cursor is a lamp raking across it. */
(function (HA) {
  'use strict';
  var U = HA.util;

  // Full-screen triangle; v_uv runs 0..1 from the top-left.
  var VS = '#version 300 es\n' + [
    'out vec2 v_uv;',
    'void main() {',
    '  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);',
    '  v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);',
    '  gl_Position = vec4(p, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* Bake: the topology. Domain-warped ridged noise gives folded, crumpled
     paint; the letters are a raised, calmer plateau within it. */
  var BAKE = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 v_uv;',
    'uniform sampler2D u_mask;',   // letter coverage (top-down)
    'uniform sampler2D u_field;',  // palette for the field (N x 1)
    'uniform sampler2D u_pale;',   // palette for the letters (M x 1)
    'uniform vec2 u_res;',         // css px
    'uniform float u_scale;',      // noise frequency per css px
    'uniform float u_step;',       // one device px, in css px
    'uniform float u_thick;',      // relief depth in css px per unit height
    'uniform vec2 u_seed;',
    'layout(location = 0) out vec4 o_albedo;',
    'layout(location = 1) out vec4 o_normal;',
    '',
    'vec2 hash2(vec2 p) {',
    '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
    '}',
    'float gnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
    '  float a = dot(hash2(i), f);',
    '  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));',
    '  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));',
    '  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);',
    'float fbm(vec2 p) {',
    '  float s = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }',
    '  return s;',
    '}',
    // crumpled ridges: sharp crests, soft valleys
    'float ridged(vec2 p) {',
    '  float s = 0.0, a = 0.62, w = 1.0;',
    '  for (int i = 0; i < 4; i++) {',
    '    float n = 1.0 - abs(gnoise(p) * 1.7);',
    '    n *= n;',
    '    s += a * n * w;',
    '    w = clamp(n * 1.3, 0.0, 1.0);',
    '    p = ROT * p * 2.07;',
    '    a *= 0.46;',
    '  }',
    '  return s;',
    '}',
    // x: crisp edge for color, y: soft shoulder for the relief
    'vec2 letterAt(vec2 uv) {',
    '  vec2 m = texture(u_mask, uv).rg;',
    '  return vec2(smoothstep(0.38, 0.62, m.r), smoothstep(0.06, 0.94, m.g));',
    '}',
    '',
    'void main() {',
    '  vec2 px = v_uv * u_res;',
    '  vec2 q = px * u_scale + u_seed;',
    '  vec2 w = vec2(fbm(q + vec2(1.7, 9.2)), fbm(q + vec2(8.3, 2.8)));',
    '  vec2 r = vec2(fbm(q + 2.0 * w + vec2(1.2, 5.1)), fbm(q + 2.0 * w + vec2(6.4, 3.7)));',
    // the painted edge of each letter wavers by a pixel or two
    '  vec2 muv = v_uv + r * 2.0 / u_res;',
    '  vec2 fq = q * 1.7 + 2.6 * r;',
    '  float e = u_step;',
    '  float ds = e * u_scale * 1.7;',
    '  float sw = 0.5 + 0.5 * fbm(q * 0.8 + 3.0 * r);',
    '  float f0 = ridged(fq), fx = ridged(fq + vec2(ds, 0.0)), fy = ridged(fq + vec2(0.0, ds));',
    '  f0 = 0.7 * f0 + 0.3 * sw; fx = 0.7 * fx + 0.3 * sw; fy = 0.7 * fy + 0.3 * sw;',
    '  vec2 l0 = letterAt(muv);',
    '  float lx = letterAt(muv + vec2(e / u_res.x, 0.0)).y;',
    '  float ly = letterAt(muv + vec2(0.0, e / u_res.y)).y;',
    '  float h0 = f0 * mix(1.0, 0.22, l0.y) + l0.y * 0.75;',
    '  float hx = fx * mix(1.0, 0.22, lx) + lx * 0.75;',
    '  float hy = fy * mix(1.0, 0.22, ly) + ly * 0.75;',
    '  vec3 N = normalize(vec3(-(hx - h0) / e * u_thick, -(hy - h0) / e * u_thick, 1.0));',
    // color in patches that follow the folds, as in the paintings
    '  float ci = fbm(q * 0.35 + 2.2 * r + 7.3);',
    '  vec3 field = texture(u_field, vec2(fract(ci * 1.7 + 0.5), 0.5)).rgb;',
    '  float pi = fbm(q * 0.6 + 1.4 * r + 3.1);',
    '  vec3 pale = mix(texture(u_pale, vec2(fract(pi * 1.5 + 0.5), 0.5)).rgb, vec3(0.9, 0.88, 0.84), 0.55);',
    '  vec3 albedo = mix(field, pale, l0.x);',
    '  float ao = mix(0.32, 1.0, smoothstep(0.1, 0.6, f0));',
    '  ao = mix(ao, 1.0, l0.y);',
    // melt into the page at the top and bottom of the hero
    '  float fade = smoothstep(0.0, 0.16, v_uv.y) * (1.0 - smoothstep(0.8, 1.0, v_uv.y));',
    '  o_albedo = vec4(albedo, max(fade, l0.y));',
    '  o_normal = vec4(N.xy * 0.5 + 0.5, ao, l0.x);',
    '}'
  ].join('\n');

  /* Light: a warm lamp over the baked surface, in a cool dark room. */
  var LIGHT = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 v_uv;',
    'uniform sampler2D u_albedo;',
    'uniform sampler2D u_normal;',
    'uniform vec2 u_res;',
    'uniform vec3 u_lamp;',      // css px (y down), height
    'uniform float u_radius;',   // reach of the lamp, css px
    'uniform float u_power;',    // 0..1, for the opening
    'out vec4 o;',
    'void main() {',
    '  vec2 tc = vec2(v_uv.x, 1.0 - v_uv.y);',
    '  vec4 A = texture(u_albedo, tc);',
    '  vec4 B = texture(u_normal, tc);',
    '  if (A.a < 0.002) { o = vec4(0.0); return; }',
    '  vec2 nxy = B.xy * 2.0 - 1.0;',
    '  vec3 N = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));',
    '  vec2 px = v_uv * u_res;',
    '  vec3 Lv = vec3(u_lamp.xy - px, u_lamp.z);',
    '  vec3 L = normalize(Lv);',
    '  float d = length(Lv.xy) / u_radius;',
    '  float reach = 1.0 / (1.0 + d * d * 2.2);',
    '  float diff = max(dot(N, L), 0.0);',
    '  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));',
    '  float nh = max(dot(N, H), 0.0);',
    '  float spec = pow(nh, 90.0) * 1.1 + 0.18 * pow(nh, 14.0);',
    '  float letter = B.w, ao = B.z;',
    '  vec3 lamp = vec3(1.0, 0.95, 0.87);',
    '  vec3 room = vec3(0.66, 0.74, 0.9);',
    '  float ambient = mix(0.22, 0.6, letter);',
    '  vec3 col = A.rgb * (room * ambient * (0.6 + 0.4 * N.z) + lamp * diff * reach * 1.5) * ao;',
    '  col += lamp * spec * reach * mix(0.55, 0.8, letter);',
    // a soft shoulder so pale paint under the lamp keeps its relief
    '  vec3 hi = 1.0 - 0.3 * exp(-(col - 0.7) / 0.3);',
    '  col = mix(col, hi, step(vec3(0.7), col));',
    '  col *= u_power;',
    '  o = vec4(col * A.a, A.a);',
    '}'
  ].join('\n');

  // Pigments measured from the paintings — used if the photos can't be read.
  var FALLBACK = {
    light: ['#e3ddd0', '#d6d9cf', '#c7cbc2', '#b3bcb6', '#cdb98a', '#b9c49a', '#a9bcc6', '#d7b3a8', '#e8d9b8'],
    mid: ['#1f5f9c', '#2c7b80', '#8e3443', '#4e8853', '#a8603b', '#835a6a', '#a9a833', '#c8a93d', '#386a7e', '#608e92'],
    dark: ['#274549', '#1a4c74', '#142432', '#50212a', '#47693f', '#2a333c']
  };

  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Separable box blur on a single-channel float image. */
  function blur(src, w, h, r) {
    if (r < 1) return src.slice();
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), norm = 1 / (2 * r + 1);
    var x, y, acc, i;
    for (y = 0; y < h; y++) {
      var row = y * w;
      acc = 0;
      for (i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
      for (x = 0; x < w; x++) {
        tmp[row + x] = acc * norm;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (x = 0; x < w; x++) {
      acc = 0;
      for (i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (y = 0; y < h; y++) {
        out[y * w + x] = acc * norm;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  /* Real colors from the paintings: pale (for the letters), vivid
     mid-tones and deep tones (for the field). */
  function sampleColors(imgs) {
    var S = 160, c = document.createElement('canvas');
    c.width = c.height = S;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    var rand = U.rng(11), all = [];
    imgs.forEach(function (img, n) {
      ctx.drawImage(img, 0, 0, S, S);
      var d = ctx.getImageData(0, 0, S, S).data;
      for (var i = 0; i < 2400; i++) {
        var k = Math.floor(rand() * S * S) * 4;
        var o = U.oklab(d[k], d[k + 1], d[k + 2]);
        all.push({ rgb: [d[k], d[k + 1], d[k + 2]], L: o[0], C: Math.hypot(o[1], o[2]), first: n === 0 });
      }
    });
    if (all.length < 500) throw new Error('not enough samples');
    var Ls = all.map(function (s) { return s.L; }).sort(function (a, b) { return a - b; });
    var q = function (p) { return Ls[Math.floor(p * (Ls.length - 1))]; };
    var qLight = q(0.8), qMidLo = q(0.3), qMidHi = q(0.85), qDarkLo = q(0.08), qDarkHi = q(0.45);
    var Cs = all.map(function (s) { return s.C; }).sort(function (a, b) { return a - b; });
    var cVivid = Cs[Math.floor(0.55 * (Cs.length - 1))];
    var out = { light: [], mid: [], dark: [] }, pale = [];
    all.forEach(function (s) {
      if (s.L >= qLight) pale.push(s);
      // the field mirrors the first (most sculptural) painting; others add a little
      var keep = s.first || rand() < 0.25;
      if (keep && s.L >= qMidLo && s.L <= qMidHi && s.C >= cVivid) out.mid.push(s.rgb);
      if (keep && s.L >= qDarkLo && s.L <= qDarkHi) out.dark.push(s.rgb);
    });
    // favor the tinted pales (rose, gold, sky, mint) over plain greys
    pale.sort(function (a, b) { return b.C - a.C; });
    pale.forEach(function (s, i) {
      out.light.push(s.rgb);
      if (i < pale.length * 0.5) out.light.push(s.rgb);
    });
    if (out.light.length < 40 || out.mid.length < 40 || out.dark.length < 40) throw new Error('flat palette');
    return out;
  }

  function fallbackColors() {
    return {
      light: FALLBACK.light.map(hexToRgb),
      mid: FALLBACK.mid.map(hexToRgb),
      dark: FALLBACK.dark.map(hexToRgb)
    };
  }

  function Hero(section) {
    this.section = section;
    this.canvas = section.querySelector('.hero__canvas');
    this.nameEl = section.querySelector('.hero__name');
    this.reduce = U.reducedMotion();
    this.visible = true;
    this.running = false;
    this.ready = false;
    this.pointer = { x: 0, y: 0, inside: false, until: 0 };
    this.lamp = { x: 0, y: 0 };
    this.tick = this.tick.bind(this);
  }

  Hero.prototype.init = function (imageUrls) {
    var self = this, gl;
    try {
      gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    } catch (e) { gl = null; }
    if (!gl) return Promise.resolve(false);
    this.gl = gl;
    try {
      this.setupGL();
    } catch (err) {
      console.warn('[hero] falling back to plain type:', err);
      return Promise.resolve(false);
    }

    var fontReady = document.fonts && document.fonts.load
      ? Promise.race([document.fonts.load('900 100px "Fraunces"', this.text()), U.timeout(2500)])
      : Promise.resolve();
    var colorsReady = Promise.race([
      Promise.all(imageUrls.slice(0, 4).map(U.loadImage)).then(sampleColors),
      U.timeout(2200).then(function () { throw new Error('slow images'); })
    ]).catch(function () { return fallbackColors(); });

    return Promise.all([fontReady, colorsReady]).then(function (res) {
      self.colors = res[1];
      self.fontLoaded = !document.fonts || document.fonts.check('900 100px "Fraunces"', self.text());
      self.uploadPalettes();
      self.layout();
      self.section.classList.add('is-painted');
      self.t0 = performance.now();
      self.bind();
      self.wake();
      return true;
    }).catch(function (err) {
      console.warn('[hero] falling back to plain type:', err);
      return false;
    });
  };

  Hero.prototype.text = function () {
    return (this.nameEl.textContent || '').replace(/\s+/g, ' ').trim();
  };

  Hero.prototype.setupGL = function () {
    var gl = this.gl;
    this.bake = U.program(gl, VS, BAKE);
    this.light = U.program(gl, VS, LIGHT);
    this.ub = U.uniforms(gl, this.bake, ['u_mask', 'u_field', 'u_pale', 'u_res', 'u_scale', 'u_step', 'u_thick', 'u_seed']);
    this.ul = U.uniforms(gl, this.light, ['u_albedo', 'u_normal', 'u_res', 'u_lamp', 'u_radius', 'u_power']);
    this.vao = gl.createVertexArray();
    this.maskTex = this.texture(gl.LINEAR);
    this.fieldTex = this.texture(gl.NEAREST);
    this.paleTex = this.texture(gl.NEAREST);
    this.albedoTex = this.texture(gl.NEAREST);
    this.normalTex = this.texture(gl.NEAREST);
    this.fbo = gl.createFramebuffer();
    gl.disable(gl.BLEND);

    var self = this;
    this.canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.stop();
      self.ready = false;
      self.section.classList.remove('is-painted');
    });
    this.canvas.addEventListener('webglcontextrestored', function () {
      try {
        self.setupGL();
        self.uploadPalettes();
        self.layout();
        self.section.classList.add('is-painted');
        self.wake();
      } catch (err) { /* stay on plain type */ }
    });
  };

  Hero.prototype.texture = function (filter) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  /* Two strips of real paint colors, shuffled so neighbors contrast the way
     adjacent marks do in the paintings. The field's colors get their chroma
     lifted a little: the photos are flatter than the paint. */
  Hero.prototype.uploadPalettes = function () {
    var gl = this.gl, c = this.colors, rand = U.rng(5);
    function boost(list, k) {
      return list.map(function (rgb) {
        var o = U.oklab(rgb[0], rgb[1], rgb[2]);
        return U.oklabToRgb(o[0], o[1] * k, o[2] * k);
      });
    }
    c = { light: c.light, mid: boost(c.mid, 1.2), dark: boost(c.dark, 1.15) };
    function strip(n, pickers) {
      var data = new Uint8Array(n * 4);
      for (var i = 0; i < n; i++) {
        var x = rand(), list = pickers[pickers.length - 1][1];
        for (var j = 0, acc = 0; j < pickers.length; j++) {
          acc += pickers[j][0];
          if (x < acc) { list = pickers[j][1]; break; }
        }
        var col = list[Math.floor(rand() * list.length)];
        data.set([col[0], col[1], col[2], 255], i * 4);
      }
      return data;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 48, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      strip(48, [[0.55, c.mid], [0.37, c.dark], [0.08, c.light]]));
    gl.bindTexture(gl.TEXTURE_2D, this.paleTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 24, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      strip(24, [[1, c.light]]));
  };

  /* Draw the (invisible) heading into a mask, then bake the surface. */
  Hero.prototype.layout = function () {
    var gl = this.gl, sec = this.section;
    var rect = sec.getBoundingClientRect();
    var W = rect.width, H = rect.height;
    if (!W || !H) return;
    // keep the bake affordable on very large screens
    var dpr = Math.min(U.dpr(), Math.sqrt(4.2e6 / (W * H)));
    this.W = W; this.H = H; this.dpr = dpr;
    var bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr));
    this.canvas.width = bw;
    this.canvas.height = bh;

    var cs = getComputedStyle(this.nameEl);
    var fs = parseFloat(cs.fontSize) || 120;
    var ls = parseFloat(cs.letterSpacing) || 0;
    this.fs = fs;

    // The text is set small and scaled up so the font uses its sturdy text
    // cut (optical size follows font-size) — the heading does the same in CSS.
    var K = 0.5, mw = Math.ceil(W * K), mh = Math.ceil(H * K);
    var SMALL = 12, scale = (fs * K) / SMALL;
    var mc = document.createElement('canvas');
    mc.width = mw; mc.height = mh;
    var ctx = mc.getContext('2d', { willReadFrequently: true });
    ctx.font = '900 ' + SMALL + 'px "Fraunces", "Iowan Old Style", Georgia, serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls * SMALL / fs) + 'px';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    var met = ctx.measureText('Hg');
    var asc = (met.fontBoundingBoxAscent || SMALL * 0.98) * scale;
    var desc = (met.fontBoundingBoxDescent || SMALL * 0.26) * scale;
    var top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
    this.nameEl.querySelectorAll('.hero__word').forEach(function (w) {
      var r = w.getBoundingClientRect();
      var txt = w.textContent;
      var tw = ctx.measureText(txt).width * scale;
      var sx = tw > 0 ? (r.width * K) / tw : 1;
      var baseline = (r.top - rect.top) * K + (r.height * K - (asc + desc)) / 2 + asc;
      ctx.save();
      ctx.translate((r.left - rect.left) * K, baseline);
      ctx.scale(scale * sx, scale);
      ctx.fillText(txt, 0, 0);
      ctx.restore();
      top = Math.min(top, r.top - rect.top);
      bottom = Math.max(bottom, r.bottom - rect.top);
      left = Math.min(left, r.left - rect.left);
      right = Math.max(right, r.right - rect.left);
    });
    this.box = { top: top, bottom: bottom, left: left, right: right };

    var px = ctx.getImageData(0, 0, mw, mh).data;
    var mask = new Float32Array(mw * mh);
    for (var i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] / 255;
    var crisp = blur(mask, mw, mh, 1);
    var rb = Math.max(1, Math.round(fs * K * 0.024));
    var wide = blur(blur(mask, mw, mh, rb), mw, mh, rb);
    var bytes = new Uint8Array(mw * mh * 2);
    for (i = 0; i < mw * mh; i++) {
      bytes[i * 2] = Math.round(crisp[i] * 255);
      bytes[i * 2 + 1] = Math.round(wide[i] * 255);
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, mw, mh, 0, gl.RG, gl.UNSIGNED_BYTE, bytes);

    // Bake color + slope into two textures in one pass.
    [this.albedoTex, this.normalTex].forEach(function (t) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.albedoTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.normalTex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error('framebuffer incomplete');
    }
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.bake);
    gl.bindVertexArray(this.vao);
    var ub = this.ub;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.maskTex); gl.uniform1i(ub.u_mask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fieldTex); gl.uniform1i(ub.u_field, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.paleTex); gl.uniform1i(ub.u_pale, 2);
    gl.uniform2f(ub.u_res, W, H);
    gl.uniform1f(ub.u_scale, 1 / Math.max(36, fs * 0.55));
    gl.uniform1f(ub.u_step, 1 / dpr);
    gl.uniform1f(ub.u_thick, Math.max(6, fs * 0.07));
    gl.uniform2f(ub.u_seed, 3.7, 1.9);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);

    this.ready = true;
    if (!this.lampInit) {
      this.lamp.x = left - fs;
      this.lamp.y = (top + bottom) / 2;
      this.lampInit = true;
    }
    this.dirty = true;
  };

  Hero.prototype.draw = function (power) {
    var gl = this.gl;
    if (!gl || gl.isContextLost() || !this.ready) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.light);
    gl.bindVertexArray(this.vao);
    var ul = this.ul;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.albedoTex); gl.uniform1i(ul.u_albedo, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.normalTex); gl.uniform1i(ul.u_normal, 1);
    gl.uniform2f(ul.u_res, this.W, this.H);
    gl.uniform3f(ul.u_lamp, this.lamp.x, this.lamp.y, Math.max(120, this.fs * 0.85));
    gl.uniform1f(ul.u_radius, Math.max(260, this.W * 0.3));
    gl.uniform1f(ul.u_power, power);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  Hero.prototype.bind = function () {
    var self = this, sec = this.section, p = this.pointer;
    function local(e) {
      var r = sec.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    sec.addEventListener('pointermove', function (e) {
      var q = local(e);
      p.x = q.x; p.y = q.y;
      p.inside = e.pointerType === 'mouse' || e.pointerType === 'pen';
      self.wake();
    }, { passive: true });
    sec.addEventListener('pointerleave', function () { p.inside = false; self.wake(); });
    sec.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      var q = local(e);
      p.x = q.x; p.y = q.y;
      p.until = performance.now() + 3000;
      self.wake();
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        if (self.visible) self.wake(); else self.stop();
      }).observe(sec);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.stop(); else self.wake();
    });

    var lastW = sec.clientWidth, lastH = sec.clientHeight, timer = 0;
    var relayout = function () {
      try { self.layout(); } catch (err) { console.warn('[hero]', err); }
      self.wake();
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        var w = sec.clientWidth, h = sec.clientHeight;
        if (w === lastW && Math.abs(h - lastH) < 2) return;
        lastW = w; lastH = h;
        clearTimeout(timer);
        timer = setTimeout(relayout, 180);
      }).observe(sec);
    }
    // If the display font arrives late, rebuild the relief with it.
    if (!this.fontLoaded && document.fonts) {
      document.fonts.load('900 100px "Fraunces"', this.text()).then(function () {
        if (document.fonts.check('900 100px "Fraunces"', self.text())) { self.fontLoaded = true; relayout(); }
      }).catch(function () {});
    }
  };

  Hero.prototype.wake = function () {
    if (this.running || !this.visible || document.hidden || !this.ready) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  };
  Hero.prototype.stop = function () { this.running = false; };

  Hero.prototype.tick = function (now) {
    if (!this.running) return;
    var dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    var f = dt * 60, p = this.pointer, b = this.box, fs = this.fs;
    var t = (now - this.t0) / 1000;
    var cy = (b.top + b.bottom) / 2;
    var intro = this.reduce ? 1 : Math.min(1, t / 2.4);
    var ease = 1 - Math.pow(1 - intro, 3);

    var tx, ty, follow;
    if (p.inside || now < p.until) {
      tx = p.x; ty = p.y; follow = 0.16;
    } else if (this.reduce) {
      tx = b.left + (b.right - b.left) * 0.3; ty = b.top - fs * 0.2; follow = 1;
    } else if (intro < 1) {
      // the lamp is carried in from the left, across the name
      tx = b.left - fs + (b.right - b.left) * 0.55 * ease + fs * ease;
      ty = cy - fs * 0.35 * ease;
      follow = 1;
    } else {
      // then drifts on its own, slowly, over the surface
      var w = t - 2.4;
      var mid = b.left + (b.right - b.left) * 0.55;
      tx = mid + Math.sin(w * 0.23) * (b.right - b.left) * 0.42;
      ty = cy - fs * 0.35 + Math.sin(w * 0.37 + 1.1) * fs * 0.7;
      follow = 0.035;
    }
    var k = 1 - Math.pow(1 - follow, f);
    var moved = Math.abs(tx - this.lamp.x) + Math.abs(ty - this.lamp.y) > 0.15;
    this.lamp.x += (tx - this.lamp.x) * k;
    this.lamp.y += (ty - this.lamp.y) * k;

    if (moved || intro < 1 || this.dirty) {
      this.draw(this.reduce ? 1 : 0.25 + 0.75 * ease);
      this.dirty = false;
    }
    if (moved || intro < 1 || (!this.reduce && !p.inside)) requestAnimationFrame(this.tick);
    else this.running = false;
  };

  HA.Hero = Hero;
})(window.HA = window.HA || {});
