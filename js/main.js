(function () {
  'use strict';
  var D = window.DnD;
  var ui = D.ui, audio = D.audio, save = D.save, state = D.state, combat = D.combat;
  var ADV = D.ADVENTURE, HEROES = D.HEROES;
  var sceneMap = {}; ADV.scenes.forEach(function (s) { sceneMap[s.id] = s; });

  var party = null;
  var pendingSelect = [];

  function unlockOnce() { audio.unlock(); }
  document.addEventListener('pointerdown', unlockOnce);

  // ---------- menu ----------
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
    var dots = function (n) { return '●●●●●'.slice(0, n) + '○○○○○'.slice(0, 5 - n); };
    d.innerHTML = '<h3>' + h.name + ' — ' + h.role + '</h3><p class="flavor">' + h.story + '</p>' +
      '<p>Сила ' + dots(h.stats.str) + ' · Ловкость ' + dots(h.stats.dex) + ' · Ум ' + dots(h.stats.int) + ' · Харизма ' + dots(h.stats.cha) + '</p>' +
      '<p>❤ ' + h.maxHp + ' · 🛡 ' + h.defense + '</p>' +
      '<p>' + h.abilities.map(function (a) { return '<b>' + a.name + '</b> — ' + a.desc; }).join('<br>') + '</p>' +
      '<button class="choice" id="pick-' + h.id + '">Выбрать ' + h.name + '</button>';
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
      b.disabled = true; audio.sfx.dice();
      // use the hero with the higher stat of the two for fairness
      var best = party.heroes.reduce(function (a, h) { return h.def.stats[ch.stat] > a.def.stats[ch.stat] ? h : a; });
      var diff = D.rules.DIFFICULTY[ch.difficulty];
      var res = D.rules.resolveCheck({ statValue: best.def.stats[ch.stat], difficulty: diff }, Math.random);
      showDiceResult(document.getElementById('dice-tray'), res, function () {
        if (res.success) {
          if (ch.onSuccessSet) state.setFlag(party, ch.onSuccessSet, true);
          enterScene(ch.onSuccess);
        } else {
          if (ch.onFailSet) state.setFlag(party, ch.onFailSet, true);
          enterScene(ch.onFail);
        }
      });
    };
    actions.appendChild(b);
  }

  function showDiceResult(tray, res, done) {
    tray.innerHTML = '<div class="panel" style="text-align:center;font-family:\'Forum, Georgia, serif\'">' +
      '🎲 ' + res.d20 + ' + ' + res.bonus + ' = <b>' + res.total + '</b> против ' + res.difficulty +
      '<br>' + (res.success ? '<span style="color:#2e6b4f">Успех!</span>' : '<span style="color:#8b0000">Провал</span>') + '</div>';
    setTimeout(function () { tray.innerHTML = ''; done(); }, 1600);
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
      div.innerHTML = '<b>' + e.name + '</b><div class="hpbar"><i style="width:' + Math.round(e.hp / e.maxHp * 100) + '%"></i></div>';
      enemiesEl.appendChild(div);
    });
    var heroesEl = document.getElementById('combat-heroes'); heroesEl.innerHTML = '';
    party.heroes.forEach(function (h, i) {
      var div = document.createElement('div'); div.className = 'panel'; div.style.margin = '4px';
      div.innerHTML = '<b>' + h.def.name + (h.downed ? ' (без сознания)' : '') + '</b>' +
        '<div class="hpbar"><i style="width:' + ui.hpPercent(h) + '%"></i></div>';
      if (i === combatCtx.heroTurn && !h.downed) div.style.outline = '2px solid var(--gold)';
      heroesEl.appendChild(div);
    });
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
      audio.sfx.dice();
      var r = combat.heroAttack(party, combatCtx.heroTurn, firstEnemy.uid, Math.random);
      audio.sfx[r.hit ? 'hit' : 'miss']();
      advanceHero();
    };
    host.appendChild(atk);

    hero.def.abilities.forEach(function (ab) {
      if (ab.uses === 'unlimited' || ab.effect === 'utility') return; // utilities not used in combat menu
      var left = hero.abilityUses[ab.id];
      var b = document.createElement('button'); b.className = 'choice';
      b.textContent = '✦ ' + ab.name + (left !== undefined ? ' (' + left + ')' : '');
      b.disabled = (left === 0);
      b.onclick = function () {
        audio.sfx.dice();
        var target = firstEnemy ? firstEnemy.uid : null;
        if (ab.effect === 'heal') { var ally = party.heroes.filter(function (x) { return x.downed; })[0] || hero; target = ally.id; audio.sfx.heal(); }
        combat.heroAbility(party, combatCtx.heroTurn, ab.id, target, Math.random);
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
      combat.enemiesTurn(party, Math.random);
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
      '<p>Иконки: game-icons.net (CC BY 3.0).</p>' +
      '<p>Музыка: процедурная, генерируется в браузере (Web Audio).</p>' +
      '<p>Портреты и текстуры: OpenGameArt, Kenney, ambientCG (CC0).</p>' +
      '<p>Шрифты: Forum, Lora (OFL).</p>' +
      '<p>Игра сделана с любовью. 2026.</p>';
  }
})();
