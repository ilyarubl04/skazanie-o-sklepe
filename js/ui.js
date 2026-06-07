(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var ui = {};

  ui.show = function (id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    document.getElementById(id).classList.add('active');
  };

  // typewriter that renders an array of paragraphs sequentially
  ui.typeParagraphs = function (container, paragraphs, opts, done) {
    opts = opts || {}; var speed = opts.speed || 22;
    container.innerHTML = '';
    if (opts.dropcap) container.classList.add('dropcap'); else container.classList.remove('dropcap');
    var pi = 0;
    function nextPara() {
      if (pi >= paragraphs.length) { if (done) done(); return; }
      var p = document.createElement('p');
      if (/^«/.test(paragraphs[pi])) p.className = 'flavor';
      container.appendChild(p);
      var text = paragraphs[pi], ci = 0;
      var timer = setInterval(function () {
        p.textContent += text.charAt(ci); ci++;
        if (ci >= text.length) { clearInterval(timer); pi++; setTimeout(nextPara, 220); }
      }, speed);
      // allow tap-to-skip
      container._skip = function () { clearInterval(timer); p.textContent = text; pi++; nextPara(); };
    }
    nextPara();
  };
  ui.skipTyping = function (container) { if (container._skip) container._skip(); };

  ui.renderChoices = function (host, choices, party, onPick) {
    host.innerHTML = '';
    choices.forEach(function (c) {
      var visible = true;
      if (c.requires && c.requires.flag) visible = !!party.flags[c.requires.flag];
      if (!visible) return;
      var b = document.createElement('button');
      b.className = 'choice'; b.textContent = c.label;
      b.onclick = function () { onPick(c); };
      host.appendChild(b);
    });
  };

  ui.hpPercent = function (hero) { return Math.round((hero.hp / hero.maxHp) * 100); };

  root.DnD.ui = ui;
})(typeof window !== 'undefined' ? window : global);
