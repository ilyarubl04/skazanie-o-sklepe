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

  // is a hero (by def id) in the party?
  function partyHasHero(party, heroId) {
    return (party.heroes || []).some(function (h) { return (h.id || (h.def && h.def.id)) === heroId; });
  }
  // does any party hero have this ability (matched by ability id OR effect tag)?
  function partyHasAbility(party, tag) {
    return (party.heroes || []).some(function (h) {
      var abilities = (h.def && h.def.abilities) || [];
      return abilities.some(function (a) { return a.id === tag || a.effect === tag; });
    });
  }
  // a choice is shown only if ALL its requirements are met (flag / hero / ability)
  ui.choiceVisible = function (c, party) {
    var r = c && c.requires;
    if (!r) return true;
    if (r.flag && !party.flags[r.flag]) return false;
    if (r.hero && !partyHasHero(party, r.hero)) return false;
    if (r.ability && !partyHasAbility(party, r.ability)) return false;
    return true;
  };

  ui.renderChoices = function (host, choices, party, onPick) {
    host.innerHTML = '';
    choices.forEach(function (c) {
      if (!ui.choiceVisible(c, party)) return;
      var b = document.createElement('button');
      b.className = 'choice'; b.textContent = c.label;
      b.onclick = function () { onPick(c); };
      host.appendChild(b);
    });
  };

  ui.hpPercent = function (hero) { return Math.round((hero.hp / hero.maxHp) * 100); };

  root.DnD.ui = ui;
})(typeof window !== 'undefined' ? window : global);
