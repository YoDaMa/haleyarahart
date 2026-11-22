/* Small shared helpers: WebGL setup, seeded randomness, color math. */
(function (HA) {
  'use strict';

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile failed: ' + log);
    }
    return shader;
  }

  function program(gl, vsSource, fsSource) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  function uniforms(gl, prog, names) {
    var out = {};
    names.forEach(function (n) { out[n] = gl.getUniformLocation(prog, n); });
    return out;
  }

  /* Deterministic PRNG so the painted name is the same on every visit. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* sRGB (0-255) -> OKLab, for perceptual color decisions. */
  function lin(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function oklab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function oklabToRgb(L, a, b) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    var rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
    return rgb.map(function (v) {
      v = Math.max(0, Math.min(1, v));
      v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      return Math.round(v * 255);
    });
  }

  function hex(rgb) {
    return '#' + rgb.map(function (v) {
      var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function whenLoaded(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve(img);
    return new Promise(function (resolve, reject) {
      img.addEventListener('load', function () { resolve(img); }, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  }

  function timeout(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  HA.util = {
    compile: compile,
    program: program,
    uniforms: uniforms,
    rng: rng,
    oklab: oklab,
    oklabToRgb: oklabToRgb,
    hex: hex,
    loadImage: loadImage,
    whenLoaded: whenLoaded,
    timeout: timeout,
    reducedMotion: function () {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    finePointer: function () {
      return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    },
    dpr: function () { return Math.min(window.devicePixelRatio || 1, 2); }
  };
})(window.HA = window.HA || {});
