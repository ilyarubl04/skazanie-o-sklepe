(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var diceThrow = {};

  // Guard: in Node (tests) there is no document/canvas. Attach the namespace
  // with a no-op-ish roll so requiring this file never throws, then bail.
  var hasDOM = (typeof document !== 'undefined' && document.createElement);

  // -- tuning constants (visual physics; result is decided separately/fairly) --
  var FRICTION = 0.985;        // linear damping per frame while sliding
  var ANG_FRICTION = 0.97;     // angular damping per frame
  var BOUNCE = 0.62;           // energy kept on a wall bounce (0..1)
  var REST_SPEED = 0.45;       // px/frame below which we consider "slow"
  var REST_ANG = 0.012;        // rad/frame below which spin is "slow"
  var REST_FRAMES = 8;         // consecutive slow frames before settle
  var TAP_SPEED = 11;          // auto-throw speed when player only taps
  var DIE_R = 46;              // die radius in px
  var BOUNCE_SFX_MS = 90;      // throttle window for bounce clacks

  diceThrow.roll = function (opts) {
    opts = opts || {};
    var onSettle = typeof opts.onSettle === 'function' ? opts.onSettle : function () {};
    var prompt = opts.prompt || 'Бросьте кубик';

    // FAIRNESS: pick the final face NOW, uniform 1..20, independent of the throw.
    var finalFace = Math.floor(Math.random() * 20) + 1;

    // In a non-browser environment just deliver the fair face and return.
    if (!hasDOM) { onSettle(finalFace); return finalFace; }

    var audio = root.DnD && root.DnD.audio;

    // ---- build overlay + canvas ----
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:200;background:rgba(8,5,2,.82);' +
      'display:flex;align-items:center;justify-content:center;' +
      "touch-action:none;-webkit-user-select:none;user-select:none;";

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;cursor:grab;';
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function resize() {
      W = overlay.clientWidth; H = overlay.clientHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- die physics state ----
    // start resting in the lower-centre area
    var die = {
      x: W / 2,
      y: H * 0.72,
      vx: 0, vy: 0,
      angle: 0, av: 0,
      face: finalFace,        // shown number (tumbles while fast)
      moving: false,
      settled: false
    };
    var slowFrames = 0;
    var lastBounceAt = 0;
    var rafId = null;
    var finished = false;     // guards the single onSettle + teardown
    var awaitingContinue = false;

    // ---- pointer / flick tracking ----
    var dragging = false;
    var samples = [];         // recent {x,y,t} for velocity estimate
    var dragStart = null;

    function localPoint(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function pushSample(p) {
      samples.push({ x: p.x, y: p.y, t: (typeof performance !== 'undefined' ? performance.now() : Date.now()) });
      // keep only the last ~80ms of motion for a responsive flick estimate
      var cut = samples[samples.length - 1].t - 80;
      while (samples.length > 2 && samples[0].t < cut) samples.shift();
    }

    function onDown(ev) {
      if (finished) return;
      ev.preventDefault();
      // first interaction unlocks audio for Safari
      if (audio && audio.unlock) audio.unlock();
      if (awaitingContinue) { finish(); return; }
      if (die.moving || die.settled) return;
      var p = localPoint(ev);
      dragging = true;
      dragStart = p;
      samples = [];
      pushSample(p);
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    function onMove(ev) {
      if (!dragging || finished) return;
      ev.preventDefault();
      var p = localPoint(ev);
      pushSample(p);
      // let the die follow the finger a little while held (feels tactile)
      die.x = p.x; die.y = p.y;
    }
    function onUp(ev) {
      if (!dragging || finished) return;
      ev.preventDefault();
      dragging = false;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      launch();
    }

    function launch() {
      // estimate flick velocity from the last couple of samples
      var vx = 0, vy = 0;
      if (samples.length >= 2) {
        var a = samples[0], b = samples[samples.length - 1];
        var dt = Math.max(8, b.t - a.t); // ms, avoid divide-by-zero
        vx = (b.x - a.x) / dt * 16;       // scale to ~px per frame (16ms)
        vy = (b.y - a.y) / dt * 16;
      }
      var speed = Math.sqrt(vx * vx + vy * vy);
      // a weak tap still throws fairly — just a shorter, gentler toss
      if (speed < 2.5) {
        var ang = Math.random() * Math.PI * 2;
        vx = Math.cos(ang) * TAP_SPEED;
        vy = -Math.abs(Math.sin(ang) * TAP_SPEED) - 4; // bias upward/away
        speed = TAP_SPEED;
      }
      die.vx = vx;
      die.vy = vy;
      // spin proportional to throw strength, with a random sign
      die.av = (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.min(0.5, speed * 0.02));
      die.moving = true;
      slowFrames = 0;
    }

    // walls are the inner overlay bounds, inset by the die radius
    function step() {
      if (die.moving) {
        die.x += die.vx;
        die.y += die.vy;
        die.angle += die.av;
        die.vx *= FRICTION;
        die.vy *= FRICTION;
        die.av *= ANG_FRICTION;

        var minX = DIE_R, maxX = W - DIE_R;
        var minY = DIE_R, maxY = H - DIE_R;
        var bounced = false;
        if (die.x < minX) { die.x = minX; die.vx = -die.vx * BOUNCE; bounced = true; }
        else if (die.x > maxX) { die.x = maxX; die.vx = -die.vx * BOUNCE; bounced = true; }
        if (die.y < minY) { die.y = minY; die.vy = -die.vy * BOUNCE; bounced = true; }
        else if (die.y > maxY) { die.y = maxY; die.vy = -die.vy * BOUNCE; bounced = true; }
        if (bounced) {
          die.av *= 0.8; // a wall scrubs some spin
          var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          // throttle: only clack if it's been a moment AND the hit had some energy
          if (now - lastBounceAt > BOUNCE_SFX_MS && Math.abs(die.vx) + Math.abs(die.vy) > 1.2) {
            lastBounceAt = now;
            if (audio && audio.sfx && audio.sfx.diceBounce) audio.sfx.diceBounce();
          }
        }

        var speed = Math.sqrt(die.vx * die.vx + die.vy * die.vy);
        // while fast, the number tumbles; as it slows, ease toward the final face
        if (speed > 2.2 || Math.abs(die.av) > 0.06) {
          if (Math.random() < 0.55) die.face = Math.floor(Math.random() * 20) + 1;
        } else {
          die.face = finalFace; // lock the fair result as it settles
        }

        if (speed < REST_SPEED && Math.abs(die.av) < REST_ANG) {
          slowFrames++;
          if (slowFrames >= REST_FRAMES) settle();
        } else {
          slowFrames = 0;
        }
      }
      draw();
      if (!finished) rafId = window.requestAnimationFrame(step);
    }

    function settle() {
      die.moving = false;
      die.settled = true;
      die.face = finalFace;
      die.vx = die.vy = die.av = 0;
      awaitingContinue = true;
      if (audio && audio.sfx && audio.sfx.diceLand) audio.sfx.diceLand();
    }

    // ---- rendering ----
    function draw() {
      ctx.clearRect(0, 0, W, H);

      // faint table patch under the die (wood/parchment tone)
      var tableY = H * 0.5;
      var tg = ctx.createLinearGradient(0, tableY, 0, H);
      tg.addColorStop(0, 'rgba(40,28,16,0)');
      tg.addColorStop(1, 'rgba(60,42,24,0.45)');
      ctx.fillStyle = tg;
      ctx.fillRect(0, tableY, W, H - tableY);

      // prompt + hint text
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8d6a8';
      ctx.font = "28px Forum, Georgia, serif";
      ctx.fillText(prompt, W / 2, Math.max(48, H * 0.16));
      ctx.fillStyle = 'rgba(212,168,83,0.75)';
      ctx.font = "16px Georgia, serif";
      if (die.settled) {
        ctx.fillText('Нажмите, чтобы продолжить', W / 2, Math.max(78, H * 0.16 + 30));
      } else if (!die.moving) {
        ctx.fillText('Проведите по кубику, чтобы бросить', W / 2, Math.max(78, H * 0.16 + 30));
      }

      var speed = Math.sqrt(die.vx * die.vx + die.vy * die.vy);

      // motion trail while moving fast
      if (die.moving && speed > 4) {
        var steps = 4;
        for (var i = steps; i >= 1; i--) {
          var tx = die.x - die.vx * i * 0.9;
          var ty = die.y - die.vy * i * 0.9;
          drawDie(tx, ty, die.angle - die.av * i, 0.10 * (1 - i / (steps + 1)), null);
        }
      }

      // shadow scales with "height" proxy (speed): faster => higher => bigger/softer
      var lift = Math.min(1, speed / 16);
      drawShadow(die.x, die.y, lift);
      drawDie(die.x, die.y, die.angle, 1, die.face);
    }

    function drawShadow(x, y, lift) {
      var sr = DIE_R * (0.9 + lift * 0.7);
      var off = 8 + lift * 22;
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - lift * 0.4);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y + off, sr, sr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // a chunky 20-sided-ish polygon (hexagon outline with inner facets) in gold
    function drawDie(x, y, angle, alpha, face) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(angle);

      var r = DIE_R, sides = 6;
      ctx.beginPath();
      for (var i = 0; i < sides; i++) {
        var a = (Math.PI * 2 / sides) * i - Math.PI / 2;
        var px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();

      var grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, '#e9c574');
      grad.addColorStop(0.5, '#d4a853');
      grad.addColorStop(1, '#9c7327');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#6e4f1c';
      ctx.stroke();

      // inner facet lines to read as a d20
      ctx.beginPath();
      var inset = r * 0.5;
      for (var j = 0; j < sides; j++) {
        var b = (Math.PI * 2 / sides) * j - Math.PI / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(b) * inset, Math.sin(b) * inset);
      }
      ctx.strokeStyle = 'rgba(110,79,28,0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // the number — keep it upright-ish by counter-rotating a touch isn't
      // necessary; large legible glyph centred on the die
      if (face != null) {
        ctx.rotate(-angle); // draw number unrotated so it's always readable
        ctx.fillStyle = '#3a2810';
        ctx.font = "bold " + Math.round(r * 0.9) + "px Forum, Georgia, serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(face), 0, 2);
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }

    // ---- teardown: cancel rAF, remove canvas + every listener, fire once ----
    function finish() {
      if (finished) return;       // hard guard: onSettle exactly once
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

    // attach listeners
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // kick off the loop
    rafId = window.requestAnimationFrame(step);
    return finalFace;
  };

  root.DnD.diceThrow = diceThrow;
  if (typeof module !== 'undefined' && module.exports) module.exports = diceThrow;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
