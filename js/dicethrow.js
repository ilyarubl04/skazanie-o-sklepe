(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var diceThrow = {};

  // In Node (tests) there is no document/canvas — attach the namespace and bail.
  var hasDOM = (typeof document !== 'undefined' && document.createElement);

  // ---- a real icosahedron (d20): 12 vertices, 20 triangular faces ----
  var PHI = (1 + Math.sqrt(5)) / 2;
  var IV = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
  ];
  var IF = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  (function normalize() {
    var n = Math.sqrt(1 + PHI * PHI);
    for (var i = 0; i < IV.length; i++) { IV[i][0] /= n; IV[i][1] /= n; IV[i][2] /= n; }
  })();
  var LIGHT = (function () { var l = [-0.35, -0.7, 0.85], m = Math.sqrt(l[0]*l[0]+l[1]*l[1]+l[2]*l[2]); return [l[0]/m, l[1]/m, l[2]/m]; })();

  // ---- physics tuning ----
  var GRAV = 0.95;        // downward pull on the die's height each frame
  var REST = 0.55;        // height kept after a board bounce
  var AIR = 0.992;        // horizontal air drag
  var ROLL = 0.86;        // horizontal speed kept on each board contact
  var ANG_FRICTION = 0.975;
  var DIE_R = 52;         // projected radius in px
  var KNOCK_MS = 55;      // throttle between knock sounds

  diceThrow.roll = function (opts) {
    opts = opts || {};
    var onSettle = typeof opts.onSettle === 'function' ? opts.onSettle : function () {};
    var prompt = opts.prompt || 'Бросьте кубик';

    // FAIRNESS: pick the final face now, uniform 1..20, independent of the throw.
    var finalFace = Math.floor(Math.random() * 20) + 1;
    if (!hasDOM) { onSettle(finalFace); return finalFace; }

    var audio = root.DnD && root.DnD.audio;

    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:200;background:rgba(8,5,2,.84);' +
      'display:flex;align-items:center;justify-content:center;' +
      'touch-action:none;-webkit-user-select:none;user-select:none;';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;cursor:grab;';
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    var ctx2d = canvas.getContext('2d');
    var W = 0, H = 0, groundY = 0;
    var DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    function resize() {
      W = overlay.clientWidth; H = overlay.clientHeight; groundY = H * 0.70;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize(); window.addEventListener('resize', resize);

    // 2.5D state: x = horizontal on the board, z = height above the board
    var die = {
      x: W / 2, z: 8, vx: 0, vz: 0,
      ax: 0.5, ay: 0.7, az: 0.2, avx: 0, avy: 0, avz: 0,
      moving: false, settled: false
    };
    var slowFrames = 0, frames = 0, lastKnock = 0, rafId = null, finished = false, awaitingContinue = false;

    var dragging = false, samples = [], pressedOnDie = false;
    function localPoint(ev) { var r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    function pushSample(p) {
      samples.push({ x: p.x, y: p.y, t: (typeof performance !== 'undefined' ? performance.now() : Date.now()) });
      var cut = samples[samples.length - 1].t - 80;
      while (samples.length > 2 && samples[0].t < cut) samples.shift();
    }
    function dieScreen() { return { x: die.x, y: groundY - die.z }; }

    function onDown(ev) {
      if (finished) return;
      ev.preventDefault();
      if (audio && audio.unlock) audio.unlock();
      if (awaitingContinue) { finish(); return; }
      if (die.moving || die.settled) return;
      var p = localPoint(ev);
      dragging = true; samples = []; pushSample(p);
      var s = dieScreen();
      pressedOnDie = Math.abs(p.x - s.x) < DIE_R * 1.6 && Math.abs(p.y - s.y) < DIE_R * 1.6;
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    function onMove(ev) {
      if (!dragging || finished) return;
      ev.preventDefault();
      var p = localPoint(ev); pushSample(p);
      if (pressedOnDie) { die.x = Math.max(DIE_R, Math.min(W - DIE_R, p.x)); die.z = Math.max(0, groundY - p.y); }
    }
    function onUp(ev) {
      if (!dragging || finished) return;
      ev.preventDefault(); dragging = false;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      launch();
    }

    function launch() {
      var vx = 0, vy = 0;
      if (samples.length >= 2) {
        var a = samples[0], b = samples[samples.length - 1];
        var dt = Math.max(8, b.t - a.t);
        vx = (b.x - a.x) / dt * 16;
        vy = (b.y - a.y) / dt * 16;
      }
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 2.5) {                 // a weak tap still throws fairly — gentle toss
        vx = (Math.random() * 2 - 1) * 5;
        vy = -10 - Math.random() * 4;
        speed = 11;
      }
      die.vx = vx;
      die.vz = Math.min(26, Math.max(9, -vy + 4));    // upward toss from an upward flick
      var sp = Math.min(0.9, 0.22 + speed * 0.03);
      die.avx = (Math.random() < 0.5 ? -1 : 1) * sp;
      die.avy = (Math.random() < 0.5 ? -1 : 1) * (sp * 0.8 + 0.1);
      die.avz = (Math.random() < 0.5 ? -1 : 1) * (sp * 0.5);
      die.moving = true; slowFrames = 0;
    }

    function knock(intensity) {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - lastKnock < KNOCK_MS) return;
      lastKnock = now;
      if (audio && audio.sfx && audio.sfx.woodKnock) audio.sfx.woodKnock(intensity);
    }

    function step() {
      if (die.moving) {
        frames++;
        die.x += die.vx;
        die.z += die.vz; die.vz -= GRAV;
        die.ax += die.avx; die.ay += die.avy; die.az += die.avz;

        if (die.z <= 0) {
          die.z = 0;
          if (die.vz < 0) {
            die.vz = -die.vz * REST;                 // bounce off the board
            if (die.vz > 0.8) knock(Math.min(1, 0.35 + die.vz * 0.06));
            if (die.vz < 2.2) die.vz = 0;            // kill the infinite micro-bounce
          }
          // resting on the board: strong rolling friction + spin damping
          die.vx *= 0.9;
          die.avx *= ROLL; die.avy *= ROLL; die.avz *= ROLL;
        } else {
          die.vx *= AIR;
          die.avx *= ANG_FRICTION; die.avy *= ANG_FRICTION; die.avz *= ANG_FRICTION;
        }

        // side rails
        if (die.x < DIE_R) { die.x = DIE_R; die.vx = -die.vx * 0.55; knock(0.4); }
        else if (die.x > W - DIE_R) { die.x = W - DIE_R; die.vx = -die.vx * 0.55; knock(0.4); }

        var angSpeed = Math.abs(die.avx) + Math.abs(die.avy) + Math.abs(die.avz);
        var rested = die.z === 0 && die.vz === 0 && Math.abs(die.vx) < 0.4 && angSpeed < 0.06;
        if (rested) { slowFrames++; if (slowFrames >= 6) settle(); } else slowFrames = 0;
        if (frames > 300 && !die.settled) settle();  // failsafe: the die always lands (~5s)
      }
      draw();
      if (!finished) rafId = window.requestAnimationFrame(step);
    }

    function settle() {
      die.moving = false; die.settled = true; die.z = 0;
      die.vx = die.vz = die.avx = die.avy = die.avz = 0;
      // ease rotation to a clean upright-ish resting pose
      awaitingContinue = true;
      if (audio && audio.sfx && audio.sfx.diceLand) audio.sfx.diceLand();
    }

    // ---- 3D rotation + projection + shading ----
    function rotate(v, ax, ay, az) {
      var x = v[0], y = v[1], z = v[2], t;
      // X
      t = y * Math.cos(ax) - z * Math.sin(ax); z = y * Math.sin(ax) + z * Math.cos(ax); y = t;
      // Y
      t = x * Math.cos(ay) + z * Math.sin(ay); z = -x * Math.sin(ay) + z * Math.cos(ay); x = t;
      // Z
      t = x * Math.cos(az) - y * Math.sin(az); y = x * Math.sin(az) + y * Math.cos(az); x = t;
      return [x, y, z];
    }

    function drawDie(cx, cy, r, alpha) {
      // rotate all vertices once
      var rv = new Array(IV.length);
      for (var i = 0; i < IV.length; i++) rv[i] = rotate(IV[i], die.ax, die.ay, die.az);

      // build visible faces with shading + depth
      var faces = [];
      var topFace = -1, topZ = -2;
      for (var f = 0; f < IF.length; f++) {
        var p0 = rv[IF[f][0]], p1 = rv[IF[f][1]], p2 = rv[IF[f][2]];
        // normal
        var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
        var vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        if (nz <= 0.02) continue;                       // back-face cull
        var shade = Math.max(0, nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]);
        var avgZ = (p0[2] + p1[2] + p2[2]) / 3;
        faces.push({ f: f, p0: p0, p1: p1, p2: p2, shade: shade, z: avgZ });
        if (nz > topZ) { topZ = nz; topFace = f; }       // face most toward the viewer
      }
      faces.sort(function (a, b) { return a.z - b.z; });  // painter's order (far first)

      ctx2d.save();
      ctx2d.globalAlpha = alpha;
      for (var k = 0; k < faces.length; k++) {
        var fc = faces[k];
        var sh = 0.32 + fc.shade * 0.75;                 // ambient + diffuse
        var rC = Math.round(170 * sh + 40), gC = Math.round(130 * sh + 24), bC = Math.round(60 * sh + 8);
        ctx2d.beginPath();
        ctx2d.moveTo(cx + fc.p0[0] * r, cy - fc.p0[1] * r);
        ctx2d.lineTo(cx + fc.p1[0] * r, cy - fc.p1[1] * r);
        ctx2d.lineTo(cx + fc.p2[0] * r, cy - fc.p2[1] * r);
        ctx2d.closePath();
        ctx2d.fillStyle = 'rgb(' + rC + ',' + gC + ',' + bC + ')';
        ctx2d.fill();
        ctx2d.lineWidth = 1; ctx2d.strokeStyle = 'rgba(60,40,12,0.55)'; ctx2d.stroke();

        // number on the face most facing the viewer
        if (fc.f === topFace) {
          var mx = cx + (fc.p0[0] + fc.p1[0] + fc.p2[0]) / 3 * r;
          var my = cy - (fc.p0[1] + fc.p1[1] + fc.p2[1]) / 3 * r;
          var num = die.settled ? finalFace : (die.moving ? (1 + Math.floor(Math.random() * 20)) : 20);
          ctx2d.fillStyle = '#1c1206';
          ctx2d.font = 'bold ' + Math.round(r * 0.42) + "px 'Forum', Georgia, serif";
          ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
          ctx2d.fillText(String(num), mx, my + 1);
        }
      }
      ctx2d.restore();
    }

    function draw() {
      ctx2d.clearRect(0, 0, W, H);

      // wooden board
      var bw = Math.min(W - 40, 560), bx = (W - bw) / 2, by = groundY - 20, bh = H - by - 24;
      var wood = ctx2d.createLinearGradient(0, by, 0, by + bh);
      wood.addColorStop(0, '#4a3320');
      wood.addColorStop(1, '#2c1d0f');
      ctx2d.fillStyle = wood;
      roundRect(bx, by, bw, bh, 12); ctx2d.fill();
      // plank grain
      ctx2d.strokeStyle = 'rgba(20,12,4,0.4)'; ctx2d.lineWidth = 1;
      for (var gx = 1; gx < 4; gx++) { ctx2d.beginPath(); ctx2d.moveTo(bx + bw * gx / 4, by + 6); ctx2d.lineTo(bx + bw * gx / 4, by + bh - 6); ctx2d.stroke(); }
      ctx2d.strokeStyle = 'rgba(212,168,83,0.35)'; ctx2d.lineWidth = 2; roundRect(bx, by, bw, bh, 12); ctx2d.stroke();

      // prompt + hint
      ctx2d.textAlign = 'center';
      ctx2d.fillStyle = '#e8d6a8'; ctx2d.font = "28px 'Forum', Georgia, serif";
      ctx2d.fillText(prompt, W / 2, Math.max(48, H * 0.15));
      ctx2d.fillStyle = 'rgba(212,168,83,0.78)'; ctx2d.font = "16px Georgia, serif";
      if (die.settled) ctx2d.fillText('Нажмите, чтобы продолжить', W / 2, Math.max(78, H * 0.15 + 30));
      else if (!die.moving) ctx2d.fillText('Проведите по кубику вверх, чтобы бросить', W / 2, Math.max(78, H * 0.15 + 30));

      // shadow on the board (grows + fades with height)
      var lift = Math.min(1, die.z / 160);
      ctx2d.save();
      ctx2d.globalAlpha = 0.4 * (1 - lift * 0.55);
      ctx2d.fillStyle = '#000';
      ctx2d.beginPath();
      ctx2d.ellipse(die.x, groundY + 6, DIE_R * (0.85 + lift * 0.8), DIE_R * (0.34 + lift * 0.28), 0, 0, Math.PI * 2);
      ctx2d.fill(); ctx2d.restore();

      // the die
      var s = dieScreen();
      drawDie(s.x, s.y, DIE_R, 1);

      // big result readout once settled
      if (die.settled) {
        ctx2d.fillStyle = '#d4a853';
        ctx2d.font = "bold 64px 'Forum', Georgia, serif";
        ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'alphabetic';
        ctx2d.shadowColor = 'rgba(255,200,80,.8)'; ctx2d.shadowBlur = 24;
        ctx2d.fillText(String(finalFace), W / 2, groundY + (H - groundY) / 2 + 22);
        ctx2d.shadowBlur = 0;
      }
    }
    function roundRect(x, y, w, h, r) {
      ctx2d.beginPath();
      ctx2d.moveTo(x + r, y);
      ctx2d.arcTo(x + w, y, x + w, y + h, r);
      ctx2d.arcTo(x + w, y + h, x, y + h, r);
      ctx2d.arcTo(x, y + h, x, y, r);
      ctx2d.arcTo(x, y, x + w, y, r);
      ctx2d.closePath();
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (rafId != null) { window.cancelAnimationFrame(rafId); rafId = null; }
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      onSettle(finalFace);
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    rafId = window.requestAnimationFrame(step);
    return finalFace;
  };

  root.DnD.diceThrow = diceThrow;
  if (typeof module !== 'undefined' && module.exports) module.exports = diceThrow;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
