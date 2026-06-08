(function () {
  'use strict';
  var D = window.DnD;
  var ui = D.ui, audio = D.audio, save = D.save, state = D.state, combat = D.combat;
  var ADV = D.ADVENTURE, HEROES = D.HEROES;
  var sceneMap = {}; ADV.scenes.forEach(function (s) { sceneMap[s.id] = s; });

  var party = null;
  var pendingSelect = [];

  var voice = D.voice;
  function unlockOnce() { audio.unlock(); if (voice && voice.unlock) voice.unlock(); }
  document.addEventListener('pointerdown', unlockOnce);
  if (voice && voice.init) voice.init();

  // ---------- atmospheric scene backgrounds ----------
  var _bg = { cur: null, which: 'a' };
  function setSceneBg(img) {
    if (!img || _bg.cur === img) return;
    _bg.cur = img;
    var incoming = _bg.which === 'a' ? document.getElementById('bg-b') : document.getElementById('bg-a');
    var outgoing = _bg.which === 'a' ? document.getElementById('bg-a') : document.getElementById('bg-b');
    incoming.style.backgroundImage = "url('" + img + "')";
    incoming.classList.add('show');
    if (outgoing) outgoing.classList.remove('show');
    _bg.which = _bg.which === 'a' ? 'b' : 'a';
  }
  // resolve a scene id -> background image (prefix-based)
  function sceneBg(id) {
    var base = 'assets/scenes/';
    id = id || '';
    if (id.indexOf('tavern') === 0) return base + 'tavern.jpg';
    if (id.indexOf('forest') === 0) return base + 'forest.jpg';
    if (id.indexOf('chapel') === 0) return base + 'chapel.jpg';
    if (id.indexOf('crypt') === 0) return base + 'crypt.jpg';
    if (id.indexOf('boss') === 0) return base + 'boss.jpg';
    if (id === 'start') return base + 'village.jpg';
    if (id === 'ending_light' || id === 'ending_clever') return base + 'victory.jpg';
    if (id === 'ending_bitter') return base + 'crypt.jpg';
    if (id === 'defeat_scene') return base + 'crypt.jpg';
    return base + 'menu.jpg';
  }

  // ---------- menu ----------
  setSceneBg('assets/scenes/menu.jpg');
  audio.playMusic('menu');
  document.getElementById('btn-continue').style.display = save.hasSave() ? 'block' : 'none';
  document.getElementById('btn-new').onclick = startSelect;
  document.getElementById('btn-continue').onclick = function () {
    party = save.read(); if (party) { audio.sfx.click(); enterScene(party.sceneId); }
  };
  document.getElementById('btn-credits').onclick = function () { renderCredits(); ui.show('screen-credits'); };
  document.getElementById('btn-credits-back').onclick = function () { ui.show('screen-menu'); };
  document.getElementById('btn-again').onclick = function () { save.clear(); location.reload(); };
  document.getElementById('btn-music').onclick = function (e) { e.target.style.opacity = audio.toggleMusic() ? 1 : .4; };
  document.getElementById('btn-sound').onclick = function (e) { e.target.style.opacity = audio.toggleSound() ? 1 : .4; };
  (function () {
    var vb = document.getElementById('btn-voice');
    if (!vb) return;
    vb.style.opacity = (voice && voice.on) ? 1 : .4;
    vb.onclick = function (e) { e.target.style.opacity = (voice && voice.toggle()) ? 1 : .4; };
  })();
  document.getElementById('btn-menu').onclick = function () { if (confirm('Выйти в меню? Прогресс сохранён.')) location.reload(); };

  // ---------- hero select ----------
  function startSelect() {
    audio.sfx.click(); pendingSelect = []; renderHeroGrid(); ui.show('screen-select');
  }
  // replace a failed portrait <img> with a styled heraldic crest div
  function swapToCrest(img, h) {
    if (!img.parentNode) return;
    var crest = document.createElement('div');
    crest.className = 'crest-fallback';
    crest.textContent = h.crest || '⚔️';
    img.parentNode.replaceChild(crest, img);
  }

  // ---------- reusable expanded hero card (used during play) ----------
  var STAT_LABELS = { str: 'Сила', dex: 'Ловкость', int: 'Ум', cha: 'Харизма' };
  var STAT_ORDER = ['str', 'dex', 'int', 'cha'];

  // build the framed portrait (img with emoji-crest onerror fallback, reused everywhere)
  function buildPortrait(def, cls) {
    var img = document.createElement('img');
    img.className = cls;
    img.src = def.portrait; img.alt = def.name;
    img.onerror = function () {
      if (!img.parentNode) return;
      var crest = document.createElement('div');
      crest.className = cls + ' crest-fallback';
      crest.textContent = def.crest || '⚔️';
      img.parentNode.replaceChild(crest, img);
    };
    return img;
  }

  function statBars(def) {
    var grid = document.createElement('div'); grid.className = 'statgrid';
    STAT_ORDER.forEach(function (k) {
      var row = document.createElement('div'); row.className = 'statrow';
      var pct = Math.round((def.stats[k] / 5) * 100);
      row.innerHTML = '<span class="stat-name">' + STAT_LABELS[k] + '</span>' +
        '<span class="statbar"><i style="width:' + pct + '%"></i></span>';
      grid.appendChild(row);
    });
    return grid;
  }

  // hero: a runtime party-hero ({def, hp, maxHp, downed}). opts: {active, compact}
  // returns a DOM node. Compact cards expand to the full card on tap.
  function renderHeroCard(hero, opts) {
    opts = opts || {};
    var def = hero.def;
    var hp = (typeof hero.hp === 'number') ? hero.hp : def.maxHp;
    var maxHp = hero.maxHp || def.maxHp;
    var pct = Math.max(0, Math.round((hp / maxHp) * 100));

    var card = document.createElement('div');
    card.className = 'herocard';
    if (opts.active) card.classList.add('active');
    if (hero.downed) card.classList.add('downed');

    if (opts.compact) {
      // collapsed bottom-bar: portrait + name + HP, taps to expand the full card
      card.classList.add('compact');
      var body = document.createElement('div'); body.className = 'compact-body';
      body.innerHTML = '<div class="hero-name">' + def.name + (hero.downed ? ' (без сознания)' : '') + '</div>' +
        '<div class="hpbar"><i style="width:' + pct + '%"></i></div>';
      card.appendChild(buildPortrait(def, 'herocard-portrait'));
      card.appendChild(body);
      var hint = document.createElement('span'); hint.className = 'compact-hint'; hint.textContent = 'подробнее';
      card.appendChild(hint);
      card.onclick = function () {
        var full = renderHeroCard(hero, { active: opts.active, compact: false });
        full.classList.add('expanded-overlay');
        var close = document.createElement('button'); close.className = 'choice card-close';
        close.textContent = 'Закрыть';
        full.appendChild(close);
        var back = document.createElement('div'); back.className = 'card-backdrop';
        back.appendChild(full);
        function dismiss() { if (back.parentNode) back.parentNode.removeChild(back); }
        back.onclick = function (e) { if (e.target === back) dismiss(); };
        close.onclick = dismiss;
        document.body.appendChild(back);
      };
      return card;
    }

    // ---- full expanded card ----
    var head = document.createElement('div'); head.className = 'herocard-head';
    head.appendChild(buildPortrait(def, 'herocard-portrait'));
    var titles = document.createElement('div');
    titles.innerHTML = '<div class="hero-name">' + def.name + '</div>' +
      '<div class="hero-role">' + def.role + '</div>';
    head.appendChild(titles);
    card.appendChild(head);

    // HP block
    var hpBlock = document.createElement('div'); hpBlock.className = 'herocard-hp';
    hpBlock.innerHTML = '<div class="hp-row"><span>Здоровье</span><span>' + hp + ' / ' + maxHp + '</span></div>' +
      '<div class="hpbar"><i style="width:' + pct + '%"></i></div>';
    card.appendChild(hpBlock);

    // stats
    card.appendChild(statBars(def));

    // МОЖЕТ — abilities
    var abilBlock = document.createElement('div'); abilBlock.className = 'herocard-block';
    var abilLabel = document.createElement('div'); abilLabel.className = 'hero-section-label';
    abilLabel.textContent = 'Может';
    var ul = document.createElement('ul'); ul.className = 'ability-list';
    def.abilities.forEach(function (a) {
      var li = document.createElement('li');
      li.innerHTML = '<b>' + a.name + '</b> — ' + a.desc;
      ul.appendChild(li);
    });
    abilBlock.appendChild(abilLabel); abilBlock.appendChild(ul);
    card.appendChild(abilBlock);

    // СИЛЬН. / СЛАБ.
    var swBlock = document.createElement('div'); swBlock.className = 'herocard-block';
    swBlock.innerHTML =
      '<div class="swrow is-strength"><span class="sw-tag">Сильн.</span><span>' + (def.strength || '') + '</span></div>' +
      '<div class="swrow is-weakness"><span class="sw-tag">Слаб.</span><span>' + (def.weakness || '') + '</span></div>';
    card.appendChild(swBlock);

    return card;
  }

  // render both party cards into a rail. activeIdx = highlighted hero (turn / active player).
  // On narrow screens we default to compact (expand-on-tap) so the narration stays readable.
  function renderParty(railEl, activeIdx) {
    if (!railEl || !party) return;
    railEl.innerHTML = '';
    var compact = window.matchMedia && window.matchMedia('(max-width:680px)').matches;
    party.heroes.forEach(function (h, i) {
      var card = renderHeroCard(h, { active: i === activeIdx, compact: compact });
      card.setAttribute('data-idx', i); // so combat flash/float helpers can find it
      railEl.appendChild(card);
    });
  }

  function renderHeroGrid() {
    var grid = document.getElementById('hero-grid'); grid.innerHTML = '';
    document.getElementById('select-prompt').textContent = 'Игрок ' + (pendingSelect.length + 1) + ' — выбери героя';
    HEROES.forEach(function (h) {
      var card = document.createElement('div'); card.className = 'hero-card';
      if (pendingSelect.indexOf(h.id) >= 0) card.classList.add('selected');
      var img = document.createElement('img');
      img.src = h.portrait; img.alt = h.name;
      // graceful fallback: missing portrait -> heraldic crest with the hero's emoji
      img.onerror = function () { swapToCrest(img, h); };
      var label = document.createElement('div');
      label.style.cssText = 'padding:6px;text-align:center;font-family:\'Forum, Georgia, serif\'';
      label.innerHTML = h.name + '<br><small>' + h.role + '</small>';
      card.appendChild(img); card.appendChild(label);
      card.onclick = function () { showHeroDetail(h); };
      grid.appendChild(card);
    });
  }
  function showHeroDetail(h) {
    var d = document.getElementById('hero-detail');
    var stats = STAT_ORDER.map(function (k) {
      var pct = Math.round((h.stats[k] / 5) * 100);
      return '<div class="statrow"><span class="stat-name">' + STAT_LABELS[k] + '</span>' +
        '<span class="statbar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
    d.innerHTML = '<h3>' + h.name + ' — ' + h.role + '</h3><p class="flavor">' + h.story + '</p>' +
      '<div class="statgrid">' + stats + '</div>' +
      '<p style="font-family:\'Forum\',Georgia,serif;letter-spacing:.05em;">❤ ' + h.maxHp + ' · 🛡 ' + h.defense + '</p>' +
      '<div class="hero-section-label">Может</div>' +
      '<ul class="ability-list">' + h.abilities.map(function (a) { return '<li><b>' + a.name + '</b> — ' + a.desc + '</li>'; }).join('') + '</ul>' +
      '<div class="swrow is-strength"><span class="sw-tag">Сильн.</span><span>' + (h.strength || '') + '</span></div>' +
      '<div class="swrow is-weakness"><span class="sw-tag">Слаб.</span><span>' + (h.weakness || '') + '</span></div>' +
      '<button class="choice" id="pick-' + h.id + '" style="margin-top:14px;">Выбрать ' + h.name + '</button>';
    document.getElementById('pick-' + h.id).onclick = function () { pickHero(h.id); };
  }
  function pickHero(id) {
    audio.sfx.click(); pendingSelect.push(id);
    document.getElementById('hero-detail').innerHTML = '';
    if (pendingSelect.length < 2) { renderHeroGrid(); }
    else { party = state.createParty(pendingSelect); save.write(party); enterScene('start'); }
  }

  // ---------- scenes ----------
  function enterScene(id) {
    setSceneBg(sceneBg(id));
    if (voice && voice.playScene) voice.playScene(id);
    party.sceneId = id; save.write(party);
    var scene = sceneMap[id];
    audio.playMusic(scene.music);

    // scripted "trapped" wound on entering the relic chamber
    if (id === 'crypt_relic' && party.flags.trapped) {
      var victim = party.heroes.filter(function (h) { return !h.downed; })[0];
      if (victim) {
        state.damageHero(victim, 4);
        party.flags.trapped = false; // spring the trap only once
        save.write(party);
        showSceneBanner('Ловушка ранит вас!');
      }
    }

    if (scene.ending) return enterEnding(scene);
    if (scene.combat) return startSceneCombat(scene);
    ui.show('screen-scene');
    document.getElementById('topbar').style.display = 'block';
    // (re)render both hero cards for the current party; narration highlights the active player
    renderParty(document.getElementById('scene-party'), party.activePlayer);
    var textEl = document.getElementById('scene-text');
    var actions = document.getElementById('scene-actions'); actions.innerHTML = '';
    textEl.onclick = function () { ui.skipTyping(textEl); };
    ui.typeParagraphs(textEl, scene.text, { dropcap: scene.dropCap }, function () {
      if (scene.check) renderCheck(scene);
      else ui.renderChoices(actions, scene.choices, party, function (c) {
        audio.sfx.click(); if (c.set) Object.keys(c.set).forEach(function (k) { state.setFlag(party, k, c.set[k]); });
        enterScene(c.goto);
      });
    });
  }

  // small on-screen note prepended to the narration (no alert)
  function showSceneBanner(msg) {
    var textEl = document.getElementById('scene-text');
    if (!textEl) return;
    var banner = document.createElement('div');
    banner.className = 'panel';
    banner.style.cssText = 'text-align:center;color:#8b0000;font-family:\'Forum, Georgia, serif\';margin-bottom:8px;';
    banner.textContent = msg;
    textEl.parentNode.insertBefore(banner, textEl);
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 3500);
  }

  function renderCheck(scene) {
    var actions = document.getElementById('scene-actions'); actions.innerHTML = '';
    var ch = scene.check;
    var statName = { str: 'Силу', dex: 'Ловкость', int: 'Ум', cha: 'Харизму' }[ch.stat];
    var b = document.createElement('button'); b.className = 'choice';
    b.textContent = (ch.label || 'Проверка') + ' — бросок на ' + statName;
    b.onclick = function () {
      b.disabled = true;
      // use the hero with the higher stat of the two for fairness
      var best = party.heroes.reduce(function (a, h) { return h.def.stats[ch.stat] > a.def.stats[ch.stat] ? h : a; });
      var bonus = D.rules.statBonus(best.def.stats[ch.stat]);
      var diff = D.rules.DIFFICULTY[ch.difficulty];
      D.diceThrow.roll({ prompt: 'Бросок на ' + statName, onSettle: function (face) {
        var total = face + bonus;
        var res = {
          d20: face, bonus: bonus, total: total, difficulty: diff,
          success: total >= diff, crit: face === 20, critFail: face === 1
        };
        showDiceResult(document.getElementById('dice-tray'), res, function () {
          if (res.success) {
            if (ch.onSuccessSet) state.setFlag(party, ch.onSuccessSet, true);
            enterScene(ch.onSuccess);
          } else {
            if (ch.onFailSet) state.setFlag(party, ch.onFailSet, true);
            enterScene(ch.onFail);
          }
        });
      } });
    };
    actions.appendChild(b);
  }

  function showDiceResult(tray, res, done) {
    var flourish = res.crit ? '<br><span style="color:#d4a853">Критический успех — 20!</span>'
                 : res.critFail ? '<br><span style="color:#8b0000">Роковая единица!</span>' : '';
    tray.innerHTML = '<div class="panel" style="text-align:center;font-family:\'Forum, Georgia, serif\'">' +
      '🎲 ' + res.d20 + ' + ' + res.bonus + ' = <b>' + res.total + '</b> против ' + res.difficulty +
      '<br>' + (res.success ? '<span style="color:#2e6b4f">Успех!</span>' : '<span style="color:#8b0000">Провал</span>') +
      flourish + '</div>';
    setTimeout(function () { tray.innerHTML = ''; done(); }, 1600);
  }

  // ---------- combat juice helpers (presentation only) ----------
  function shake() {
    var el = document.getElementById('screen-combat');
    if (!el) return;
    el.classList.remove('shaking');
    void el.offsetWidth; // force reflow so the animation can restart
    el.classList.add('shaking');
    setTimeout(function () { el.classList.remove('shaking'); }, 320);
  }
  function flashHit(el) {
    if (!el) return;
    el.classList.remove('flash-hit');
    void el.offsetWidth;
    el.classList.add('flash-hit');
    setTimeout(function () { if (el) el.classList.remove('flash-hit'); }, 350);
  }
  function floatNumber(targetEl, text, color) {
    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') return;
    var r = targetEl.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'float-num';
    el.textContent = text;
    el.style.color = color || '#fff';
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.top + r.height * 0.28) + 'px';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
  }
  // find a rendered enemy panel by its uid (set as data-uid during renderCombat)
  function enemyPanel(uid) {
    if (!uid) return null;
    return document.querySelector('#combat-enemies [data-uid="' + uid + '"]');
  }
  // find a rendered hero panel by its party index (data-idx)
  function heroPanel(i) {
    return document.querySelector('#combat-heroes [data-idx="' + i + '"]');
  }

  // ---------- combat ----------
  var combatCtx = null;
  function startSceneCombat(scene) {
    audio.playMusic('battle');
    // noisy approach can draw a larger enemy group
    var enemies = scene.combat.enemies;
    if (scene.combat.noisyFlag && party.flags[scene.combat.noisyFlag] && scene.combat.enemiesIfNoisy) {
      enemies = scene.combat.enemiesIfNoisy;
    }
    combat.startCombat(party, enemies);
    // relic effect: weaken the boss before the fight begins
    var rel = scene.combat.relicEffect;
    if (rel && party.flags[rel.flag]) {
      party.combat.enemies.forEach(function (e) { if (e.boss) e.hp = Math.max(1, e.hp - rel.bossHpPenalty); });
    }
    combatCtx = { scene: scene, heroTurn: 0 };
    ui.show('screen-combat'); renderCombat();
  }
  function renderCombat() {
    var status = combat.combatStatus(party);
    if (status === 'won') { audio.sfx.win(); return enterScene(combatCtx.scene.combat.onWin); }
    if (status === 'lost') { save.clear(); return enterScene(combatCtx.scene.combat.onLose); }

    var enemiesEl = document.getElementById('combat-enemies'); enemiesEl.innerHTML = '';
    party.combat.enemies.filter(function (e) { return e.hp > 0 && !e.fled; }).forEach(function (e) {
      var div = document.createElement('div'); div.className = 'panel'; div.style.display = 'inline-block'; div.style.margin = '4px';
      div.setAttribute('data-uid', e.uid);
      var artSrc = e.def && e.def.art ? e.def.art : '';
      var art = artSrc ? '<img src="' + artSrc + '" class="enemy-art" alt="">' : '';
      div.innerHTML = art + '<b>' + e.name + '</b><div class="hpbar"><i style="width:' + Math.round(e.hp / e.maxHp * 100) + '%"></i></div>';
      enemiesEl.appendChild(div);
    });
    // rich hero cards with live HP; highlight whose turn it is (skip a downed hero)
    var hero = party.heroes[combatCtx.heroTurn];
    var activeIdx = (hero && !hero.downed) ? combatCtx.heroTurn : -1;
    renderParty(document.getElementById('combat-heroes'), activeIdx);
    document.getElementById('combat-log').innerHTML = party.combat.log.slice(-6).map(function (l) { return '<div>' + l + '</div>'; }).join('');
    renderCombatActions();
  }
  function renderCombatActions() {
    var host = document.getElementById('combat-actions'); host.innerHTML = '';
    var hero = party.heroes[combatCtx.heroTurn];
    if (!hero || hero.downed) { return nextHeroOrEnemies(); }
    document.getElementById('turn-indicator').textContent = 'Ходит: Игрок ' + (combatCtx.heroTurn + 1) + ' — ' + hero.def.name;
    var firstEnemy = party.combat.enemies.filter(function (e) { return e.hp > 0 && !e.fled; })[0];

    var atk = document.createElement('button'); atk.className = 'choice';
    atk.textContent = '⚔ Атаковать ' + (firstEnemy ? firstEnemy.name : '');
    atk.onclick = function () {
      if (!firstEnemy) return;
      var targetUid = firstEnemy.uid;
      D.diceThrow.roll({ prompt: 'Бросок на попадание', onSettle: function (face) {
        var r = combat.heroAttack(party, combatCtx.heroTurn, targetUid, Math.random, face);
        var panel = enemyPanel(targetUid);
        if (r.hit) {
          audio.sfx.sword();
          shake();
          flashHit(panel);
          floatNumber(panel, '−' + r.damage, '#e8413a');
        } else {
          audio.sfx.miss();
          floatNumber(panel, 'мимо', '#bdb0a0');
        }
        advanceHero();
      } });
    };
    host.appendChild(atk);

    hero.def.abilities.forEach(function (ab) {
      if (ab.uses === 'unlimited' || ab.effect === 'utility') return; // utilities not used in combat menu
      var left = hero.abilityUses[ab.id];
      var b = document.createElement('button'); b.className = 'choice';
      b.textContent = '✦ ' + ab.name + (left !== undefined ? ' (' + left + ')' : '');
      b.disabled = (left === 0);
      b.onclick = function () {
        var target = firstEnemy ? firstEnemy.uid : null;
        var healAllyIdx = -1;
        if (ab.effect === 'heal') {
          var ally = party.heroes.filter(function (x) { return x.downed; })[0] || hero;
          target = ally.id;
          healAllyIdx = party.heroes.indexOf(ally);
        }
        var enemyUid = target;
        var r = combat.heroAbility(party, combatCtx.heroTurn, ab.id, target, Math.random);
        // pick SFX by ability id/effect; fall back to sword for plain damage
        var sfxName = ab.id === 'fireball' ? 'fire'
                    : ab.id === 'precise_shot' ? 'bow'
                    : ab.id === 'turn_undead' ? 'bones'
                    : ab.effect === 'heal' ? 'heal'
                    : (r && r.damage) ? 'sword'
                    : 'dice';
        if (audio.sfx[sfxName]) audio.sfx[sfxName]();
        if (r && r.damage) {
          shake();
          var ep = enemyPanel(enemyUid);
          flashHit(ep);
          floatNumber(ep, '−' + r.damage, '#e8413a');
        }
        if (r && r.heal && healAllyIdx >= 0) {
          floatNumber(heroPanel(healAllyIdx), '+' + r.heal, '#5fd47a');
        }
        advanceHero();
      };
      host.appendChild(b);
    });
  }
  function advanceHero() {
    if (combat.combatStatus(party) !== 'ongoing') return renderCombat();
    nextHeroOrEnemies();
  }
  function nextHeroOrEnemies() {
    combatCtx.heroTurn++;
    if (combatCtx.heroTurn >= party.heroes.length) {
      combatCtx.heroTurn = 0;
      // snapshot hero hp so we can show per-hero damage from the enemies' turn
      var before = party.heroes.map(function (h) { return h.hp; });
      combat.enemiesTurn(party, Math.random);
      var anyHit = false;
      party.heroes.forEach(function (h, i) {
        var delta = before[i] - h.hp;
        if (delta > 0) {
          anyHit = true;
          var hp = heroPanel(i);
          flashHit(hp);
          floatNumber(hp, '−' + delta, '#e8413a');
        }
      });
      if (anyHit) shake();
      renderCombat();
    } else {
      // pass-device prompt between the two players
      passDevice(combatCtx.heroTurn, function () { renderCombat(); });
    }
  }

  // ---------- pass device ----------
  function passDevice(playerIndex, done) {
    document.getElementById('pass-text').textContent = 'Передайте устройство Игроку ' + (playerIndex + 1);
    ui.show('screen-pass');
    document.getElementById('btn-pass-ok').onclick = function () { ui.show('screen-combat'); done(); };
  }

  // ---------- ending ----------
  function enterEnding(scene) {
    audio.playMusic(scene.music || 'victory');
    document.getElementById('topbar').style.display = 'none';
    ui.show('screen-ending');
    var el = document.getElementById('ending-text');
    ui.typeParagraphs(el, scene.text, { dropcap: true });
  }

  // ---------- credits ----------
  function renderCredits() {
    document.getElementById('credits-body').innerHTML =
      '<p>Музыка и звук: процедурные, генерируются в браузере (Web Audio).</p>' +
      '<p>Текстура пергамента: ambientCG, Paper001 (CC0).</p>' +
      '<p>Шрифты: Forum, Lora (OFL).</p>' +
      '<p>Портреты героев — в работе. Пока показаны геральдические гербы.</p>' +
      '<p>Игра сделана с любовью. 2026.</p>';
  }
})();
