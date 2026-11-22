/* Raking light.
   Impasto is sculpture as much as color: a photo flattens it. This renderer
   rebuilds a relief map from the photo (brighter paint ~ higher ridge) and
   lights it from a movable lamp, so the ridges glint and shadow as the light
   moves — the way a thick painting changes as you walk past it. */
(function (HA) {
  'use strict';
  var U = HA.util;

  var VS = [
    'attribute vec2 a_pos;',
    'uniform vec4 u_rect;',      // destination rect in device px: x, y, w, h
    'uniform vec2 u_res;',       // canvas size in device px
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_pos;',
    '  vec2 p = u_rect.xy + a_pos * u_rect.zw;',
    '  vec2 c = p / u_res * 2.0 - 1.0;',
    '  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_texel;',     // one texel in uv
    'uniform vec4 u_crop;',      // source region: offset.xy, size.zw (uv)
    'uniform float u_aspect;',   // destination width / height
    'uniform vec3 u_light;',     // lamp position in surface units (y: 0..1 top to bottom)
    'uniform float u_amount;',   // 0 = untouched photo, 1 = fully relit
    'uniform float u_bump;',     // relief depth
    'uniform float u_spec;',     // gloss of wet oil
    'uniform float u_spot;',     // how much the lamp pools light around itself
    'uniform float u_relief;',   // strength of the relit relief
    'uniform float u_focus;',    // 0 = lamp acts everywhere; higher = only near it
    'uniform float u_floor;',    // share of the effect kept far from the lamp
    'uniform float u_tap;',      // sampling distance for the slope, in texels
    '',
    'float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
    'float hgt(vec2 uv) { return lum(texture2D(u_tex, uv).rgb); }',
    '',
    'void main() {',
    '  vec2 uv = u_crop.xy + v_uv * u_crop.zw;',
    '  vec3 albedo = texture2D(u_tex, uv).rgb;',
    '  vec2 t1 = u_texel * u_tap * 1.5;',
    '  vec2 t2 = t1 * 2.6;',
    '  float gx = 0.7 * (hgt(uv + vec2(t1.x, 0.0)) - hgt(uv - vec2(t1.x, 0.0)))',
    '           + 0.8 * (hgt(uv + vec2(t2.x, 0.0)) - hgt(uv - vec2(t2.x, 0.0)));',
    '  float gy = 0.7 * (hgt(uv + vec2(0.0, t1.y)) - hgt(uv - vec2(0.0, t1.y)))',
    '           + 0.8 * (hgt(uv + vec2(0.0, t2.y)) - hgt(uv - vec2(0.0, t2.y)));',
    '  vec3 N = normalize(vec3(-gx * u_bump, -gy * u_bump, 1.0));',
    '  vec3 P = vec3(v_uv.x * u_aspect, v_uv.y, 0.0);',
    '  vec3 Lv = u_light - P;',
    '  vec3 L = normalize(Lv);',
    '  float d2 = dot(Lv.xy, Lv.xy);',
    '  float pool = exp(-d2 * u_focus);',
    '  float reach = mix(u_floor, 1.0, pool);',
    // slopes facing the lamp brighten, slopes facing away darken; zero on
    // average, so the photo keeps its exposure and only the relief comes
    // alive. Grazing light rakes hardest; light from straight above flattens.
    '  float shade = 1.0 + 1.6 * dot(N.xy, L.xy) * u_relief * reach;',
    '  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));',
    '  float gloss = max(pow(max(dot(N, H), 0.0), 70.0) - pow(H.z, 70.0), 0.0) * u_spec * reach;',
    '  float spot = mix(1.0, 0.8 + 0.34 * pool, u_spot);',
    '  vec3 lit = albedo * shade * spot + gloss * vec3(1.0, 0.95, 0.86);',
    '  gl_FragColor = vec4(mix(albedo, lit, u_amount), 1.0);',
    '}'
  ].join('\n');

  var NAMES = ['u_rect', 'u_res', 'u_tex', 'u_texel', 'u_crop', 'u_aspect', 'u_light',
    'u_amount', 'u_bump', 'u_spec', 'u_spot', 'u_relief', 'u_focus', 'u_floor', 'u_tap'];

  function Relief(canvas, img, opts) {
    this.canvas = canvas;
    this.img = img;
    this.o = Object.assign({ crop: [0, 0, 1, 1], fullRes: false, onLost: null, onRestored: null }, opts || {});
    this.rect = null; // destination rect in CSS px inside the canvas (null = fill)
    this.p = { lx: 0.5, ly: -0.3, lz: 0.6, amount: 0, bump: 4, spec: 0.4, spot: 0, relief: 1, focus: 0, floor: 1 };
    this.cssW = 0; this.cssH = 0; this.dpr = 1;
    this.texW = 0; this.texH = 0; this.texTarget = 0;
    this.ok = false;
    this._onLost = this._onLost.bind(this);
    this._onRestored = this._onRestored.bind(this);
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
    this._setup();
  }

  Relief.supported = function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  };

  Relief.prototype._setup = function () {
    var attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
    var gl = this.gl || this.canvas.getContext('webgl2', attrs) || this.canvas.getContext('webgl', attrs);
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    this.gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.prog = U.program(gl, VS, FS);
    this.u = U.uniforms(gl, this.prog, NAMES);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.aPos = gl.getAttribLocation(this.prog, 'a_pos');
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.texW = 0;
    this.ok = true;
  };

  Relief.prototype._onLost = function (e) {
    e.preventDefault();
    this.ok = false;
    if (this.o.onLost) this.o.onLost();
  };

  Relief.prototype._onRestored = function () {
    try {
      this._setup();
      this.resize(true);
      this.render();
      if (this.o.onRestored) this.o.onRestored();
    } catch (err) { /* stay on the plain image */ }
  };

  Relief.prototype.setImage = function (img, crop) {
    this.img = img;
    if (crop) this.o.crop = crop;
    this.texW = 0; // force upload
    this.resize(true);
  };

  /* Sync the backing store with the canvas' CSS size. */
  Relief.prototype.resize = function (forceUpload) {
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    var dpr = U.dpr();
    if (!w || !h) return false;
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    this._upload(forceUpload);
    return true;
  };

  Relief.prototype._upload = function (force) {
    if (!this.ok || !this.img || !this.img.naturalWidth) return;
    var gl = this.gl, img = this.img;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var crop = this.o.crop;
    var cap = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096, 4096);
    var target;
    if (this.o.fullRes) {
      target = Math.min(iw, cap);
    } else {
      // the width, in device px, the whole photo would occupy at this size
      var drawW = (this.rect ? this.rect.w : this.cssW) * this.dpr;
      target = Math.min(Math.round(drawW / crop[2]), cap);
      if (iw <= target * 1.25) target = Math.min(iw, cap);
    }
    if (!force && this.texW && Math.abs(target - this.texTarget) / this.texTarget < 0.15) return;
    this.texTarget = target;

    var src = img, tw = iw, th = ih;
    if (target < iw) {
      tw = Math.max(2, target);
      th = Math.max(2, Math.round(target * ih / iw));
      var c = document.createElement('canvas');
      c.width = tw; c.height = th;
      var ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, tw, th);
      src = c;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); // throws on tainted images
    if (this.gl2) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    this.texW = tw; this.texH = th;
  };

  /* Destination rect in CSS px, or the whole canvas. */
  Relief.prototype.drawRect = function () {
    return this.rect || { x: 0, y: 0, w: this.cssW, h: this.cssH };
  };

  /* Convert a client (viewport) point into surface units for the lamp. */
  Relief.prototype.surfacePoint = function (clientX, clientY) {
    var b = this.canvas.getBoundingClientRect();
    var r = this.drawRect();
    return { x: (clientX - b.left - r.x) / r.h, y: (clientY - b.top - r.y) / r.h, aspect: r.w / r.h };
  };

  Relief.prototype.render = function () {
    if (!this.ok || !this.texW) return;
    var gl = this.gl, u = this.u, p = this.p, d = this.dpr;
    var r = this.drawRect();
    var crop = this.o.crop;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(u.u_tex, 0);
    gl.uniform4f(u.u_rect, r.x * d, r.y * d, r.w * d, r.h * d);
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.u_texel, 1 / this.texW, 1 / this.texH);
    gl.uniform4f(u.u_crop, crop[0], crop[1], crop[2], crop[3]);
    gl.uniform1f(u.u_aspect, r.w / r.h);
    gl.uniform3f(u.u_light, p.lx, p.ly, p.lz);
    gl.uniform1f(u.u_amount, p.amount);
    gl.uniform1f(u.u_bump, p.bump);
    gl.uniform1f(u.u_spec, p.spec);
    gl.uniform1f(u.u_spot, p.spot);
    gl.uniform1f(u.u_relief, p.relief);
    gl.uniform1f(u.u_focus, p.focus);
    gl.uniform1f(u.u_floor, p.floor);
    gl.uniform1f(u.u_tap, Math.max(1, (this.texW * crop[2]) / (r.w * d)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  Relief.prototype.destroy = function () {
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    if (this.gl && !this.gl.isContextLost()) {
      var ext = this.gl.getExtension('WEBGL_lose_context');
      this.gl.deleteTexture(this.tex);
      this.gl.deleteBuffer(this.buf);
      this.gl.deleteProgram(this.prog);
      if (ext) ext.loseContext();
    }
    this.ok = false;
    this.gl = null;
  };

  HA.Relief = Relief;
})(window.HA = window.HA || {});
