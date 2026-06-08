(function () {
  'use strict';
  var D = window.DnD;
  var ui = D.ui, audio = D.audio, save = D.save, state = D.state, combat = D.combat;
  var ADV = D.ADVENTURE, HEROES = D.HEROES;
  var WORLDMAP = D.WORLDMAP;
  var sceneMap = {}; ADV.scenes.forEach(function (s) { sceneMap[s.id] = s; });

  var party = null;
  var pendingSelect = [];

  // ---------- campaign progression (4 level-ups between acts) ----------
  // #1 has full data; #2–#4 carry their HP values now and gain choice/ult logic later (TODO).
  var LEVELUPS = [
    { hp: 6, uses: 'bestCombat' },                 // #1 → Act 2: +6 HP, +1 use best combat ability
    { hp: 8, uses: null, choice: 'sharpOrSturdy' },// #2 → Act 3: TODO co-decision (+1 dmg die | +2 def)
    { hp: 8, uses: null, choice: 'secondAbility' },// #3 → Act 4: TODO +1 use 2nd ability + utility boost
    { hp: 10, uses: null, choice: 'ultimate' }     // #4 → Act 5: TODO ultimate charge
  ];

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
    if (id === 'start' || id === 'square' || id.indexOf('well') === 0) return base + 'village.jpg';
    if (id === 'ending_light' || id === 'ending_clever') return base + 'victory.jpg';
    if (id === 'ending_bitter') return base + 'crypt.jpg';
    if (id === 'defeat_scene') return base + 'crypt.jpg';
    if (id === 'morven_truth') return base + 'crypt.jpg';   // the ominous reveal under the склеп
    if (id === 'chapter1_end') return base + 'chapel.jpg';  // dawn at the склеп threshold — season-finale
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
  // toggle the `.off` class on the BUTTON (currentTarget) — the buttons now hold an
  // inner <svg>, so e.target may be a path; currentTarget is always the <button>.
  document.getElementById('btn-music').onclick = function (e) { e.currentTarget.classList.toggle('off', !audio.toggleMusic()); };
  document.getElementById('btn-sound').onclick = function (e) { e.currentTarget.classList.toggle('off', !audio.toggleSound()); };
  (function () {
    var vb = document.getElementById('btn-voice');
    if (!vb) return;
    vb.classList.toggle('off', !(voice && voice.on));
    vb.onclick = function (e) { e.currentTarget.classList.toggle('off', !(voice && voice.toggle())); };
  })();
  document.getElementById('btn-menu').onclick = function () { if (confirm('Выйти в меню? Прогресс сохранён.')) location.reload(); };
  (function () {
    var mb = document.getElementById('btn-map');
    if (mb) mb.onclick = function () { audio.sfx.click(); enterMap(party && party.mapNode ? party.mapNode : 'tihiy_brod', true); };
  })();
  (function () {
    var hb = document.getElementById('btn-help');
    if (hb) hb.onclick = function () { audio.sfx.click(); showHowToPlay(); }; // re-open, no auto-advance
  })();

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
  function closeHeroModal() {
    var b = document.getElementById('hero-modal-back');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }
  // clicking a hero opens a modal immediately (no scrolling down to a panel)
  function showHeroDetail(h) {
    closeHeroModal();
    audio.sfx.click();
    var stats = STAT_ORDER.map(function (k) {
      var pct = Math.round((h.stats[k] / 5) * 100);
      return '<div class="statrow"><span class="stat-name">' + STAT_LABELS[k] + '</span>' +
        '<span class="statbar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
    var back = document.createElement('div'); back.className = 'card-backdrop'; back.id = 'hero-modal-back';
    var box = document.createElement('div'); box.className = 'herocard expanded-overlay';
    box.innerHTML =
      '<div class="herocard-head" style="margin-bottom:10px;">' +
        '<img class="herocard-portrait" src="' + h.portrait + '" alt="" id="hero-modal-portrait">' +
        '<div><p class="hero-name" style="font-size:1.7rem;">' + h.name + '</p><p class="hero-role">' + h.role + '</p></div>' +
      '</div>' +
      '<p class="flavor" style="font-size:1rem;line-height:1.6;margin:.2em 0 .8em;">' + h.story + '</p>' +
      '<div class="statgrid">' + stats + '</div>' +
      '<p style="font-family:\'Forum\',Georgia,serif;letter-spacing:.05em;color:var(--parchment);">❤ ' + h.maxHp + ' · 🛡 ' + h.defense + '</p>' +
      '<div class="herocard-block"><div class="hero-section-label">Может</div>' +
      '<ul class="ability-list">' + h.abilities.map(function (a) { return '<li><b>' + a.name + '</b> — ' + a.desc + '</li>'; }).join('') + '</ul></div>' +
      '<div class="swrow is-strength"><span class="sw-tag">Сильн.</span><span>' + (h.strength || '') + '</span></div>' +
      '<div class="swrow is-weakness"><span class="sw-tag">Слаб.</span><span>' + (h.weakness || '') + '</span></div>' +
      '<button class="choice" id="pick-' + h.id + '" style="margin-top:14px;">Выбрать — ' + h.name + '</button>' +
      '<button class="choice card-close" id="hero-modal-close" style="background:linear-gradient(180deg,#2a1a0c,#160d05);">Назад</button>';
    back.appendChild(box);
    back.onclick = function (e) { if (e.target === back) closeHeroModal(); };
    document.body.appendChild(back);
    var pImg = document.getElementById('hero-modal-portrait');
    if (pImg) pImg.onerror = function () { swapToCrest(pImg, h); };
    document.getElementById('pick-' + h.id).onclick = function () { closeHeroModal(); pickHero(h.id); };
    document.getElementById('hero-modal-close').onclick = function () { closeHeroModal(); };
  }
  function pickHero(id) {
    audio.sfx.click(); pendingSelect.push(id);
    if (pendingSelect.length < 2) { renderHeroGrid(); }
    else {
      party = state.createParty(pendingSelect); save.write(party);
      // warm cold open -> "how to play" (once) -> first scene
      beginAdventure();
    }
  }

  // ---------- cold open + onboarding (after both heroes picked, before scene 1) ----------
  var TUT_KEY = 'skazanie_tutorial_seen_v1';
  function tutorialSeen() {
    if (party && party.flags && party.flags.tutorialSeen) return true;
    try { return !!localStorage.getItem(TUT_KEY); } catch (e) { return false; }
  }
  function markTutorialSeen() {
    if (party) { state.setFlag(party, 'tutorialSeen', true); save.write(party); }
    try { localStorage.setItem(TUT_KEY, '1'); } catch (e) {}
  }

  // small reusable modal on the .card-backdrop style; returns a dismiss() fn
  function showModal(buildInner) {
    var back = document.createElement('div'); back.className = 'card-backdrop';
    function dismiss() { if (back.parentNode) back.parentNode.removeChild(back); }
    buildInner(back, dismiss);
    document.body.appendChild(back);
    return dismiss;
  }

  // TASK 5 — address BOTH heroes by name, then proceed
  function beginAdventure() {
    var names = party.heroes.map(function (h) { return h.def.name; });
    var joined = names.join(' и ');
    showModal(function (back, dismiss) {
      var box = document.createElement('div');
      box.className = 'herocard expanded-overlay tut-card';
      box.innerHTML =
        '<div class="tut-step">Деревня Тихий Брод</div>' +
        '<p class="tut-body">' + joined + ' — деревня Тихий Брод ждёт вас. ' +
        'Назовите своих героев вслух и шагните в историю.</p>';
      var go = document.createElement('button'); go.className = 'choice';
      go.textContent = 'Шагнуть в историю';
      go.onclick = function () { audio.sfx.click(); dismiss(); afterColdOpen(); };
      box.appendChild(go);
      back.appendChild(box);
    });
  }
  function afterColdOpen() {
    // The map is the navigation hub for the WHOLE game now: after the warm cold
    // open (and the one-time how-to-play), the adventure opens ON THE MAP at the
    // starting node — Тихий Брод — instead of jumping straight into a scene.
    if (tutorialSeen()) { openStartMap(); return; }
    showHowToPlay(function () { markTutorialSeen(); openStartMap(); });
  }
  // open the world map at the very first node for a brand-new journey
  function openStartMap() {
    state.ensureMapState(party);
    enterMap('tihiy_brod', true);
  }

  // TASK 4 — skippable 4-step "Как играть" overlay
  var TUT_STEPS = [
    'Вы — двое искателей приключений. Программа — ваш Мастер: она ведёт историю и судит правила.',
    'Когда выпадает проверка — берите кубик и бросайте его сами, своей рукой (свайп вверх).',
    'По очереди вы решаете, что делать. Имя над выбором подсказывает, чей сейчас ход.',
    'Говорите вслух и спорьте — так веселее. Удачи!'
  ];
  // onDone() runs after the last step / skip. If omitted, just closes (re-open mode).
  function showHowToPlay(onDone) {
    var step = 0;
    showModal(function (back, dismiss) {
      var box = document.createElement('div');
      box.className = 'herocard expanded-overlay tut-card';
      back.appendChild(box);
      function finish() { dismiss(); if (onDone) onDone(); }
      function render() {
        var dots = '';
        for (var i = 0; i < TUT_STEPS.length; i++) dots += '<i class="' + (i === step ? 'on' : '') + '"></i>';
        box.innerHTML =
          '<div class="tut-step">Как играть · ' + (step + 1) + ' / ' + TUT_STEPS.length + '</div>' +
          '<p class="tut-body">' + TUT_STEPS[step] + '</p>' +
          '<div class="tut-dots">' + dots + '</div>';
        var primary = document.createElement('button'); primary.className = 'choice';
        primary.textContent = (step < TUT_STEPS.length - 1) ? 'Дальше' : 'Понятно, начать!';
        primary.onclick = function () {
          audio.sfx.click();
          if (step < TUT_STEPS.length - 1) { step++; render(); } else finish();
        };
        box.appendChild(primary);
        if (step < TUT_STEPS.length - 1) {
          var skip = document.createElement('button');
          skip.className = 'choice card-close';
          skip.style.background = 'linear-gradient(180deg,#2a1a0c,#160d05)';
          skip.textContent = 'Пропустить';
          skip.onclick = function () { audio.sfx.click(); finish(); };
          box.appendChild(skip);
        }
      }
      render();
    });
  }

  // celebratory level-up overlay (reuses the .card-backdrop modal). onDone continues the scene.
  function showLevelUpOverlay(spec, onDone) {
    audio.sfx.win && audio.sfx.win();
    var hpLine = spec.hp ? ('+' + spec.hp + ' здоровья') : 'силы прибыло';
    showModal(function (back, dismiss) {
      var box = document.createElement('div');
      box.className = 'herocard expanded-overlay tut-card';
      box.innerHTML =
        '<div class="tut-step">Новый уровень!</div>' +
        '<p class="tut-body">Герои набрались сил! ' + hpLine + ', способности усилены.</p>';
      var go = document.createElement('button'); go.className = 'choice';
      go.textContent = 'Дальше';
      go.onclick = function () { audio.sfx.click(); dismiss(); if (onDone) onDone(); };
      box.appendChild(go);
      back.appendChild(box);
    });
  }

  // ---------- scenes ----------
  // A scene may carry `textVariant: { lines: {flagA:'…', flagB:'…'}, default:'…' }`:
  // the first matching party-flag picks an opening line prepended to scene.text.
  // Lets one scene (e.g. morven_truth) read differently by HOW the player got there,
  // without duplicating the whole scene. Falls back to scene.text untouched.
  function sceneText(scene) {
    var tv = scene.textVariant;
    if (!tv || !tv.lines) return scene.text;
    var pick = tv.default || '';
    var keys = Object.keys(tv.lines);
    for (var i = 0; i < keys.length; i++) {
      if (party && party.flags && party.flags[keys[i]]) { pick = tv.lines[keys[i]]; break; }
    }
    return pick ? [pick].concat(scene.text) : scene.text;
  }

  function enterScene(id) {
    // safety net: the world-map pseudo-scene routes to the map screen, never renders
    if (id === '__map__') { enterMap(party.mapNode || 'tihiy_brod', true); return; }
    setSceneBg(sceneBg(id));
    if (voice && voice.playScene) voice.playScene(id);
    party.sceneId = id; save.write(party);
    var scene = sceneMap[id];

    // campaign level-up: a scene may carry `levelUp: N` (1-based). Apply once (guarded
    // by a flag), celebrate, then re-enter the scene to continue normally.
    if (scene.levelUp && !party.flags['levelup_' + scene.levelUp]) {
      var spec = LEVELUPS[scene.levelUp - 1];
      if (spec) {
        state.applyLevelUp(party, spec);
        state.setFlag(party, 'levelup_' + scene.levelUp, true);
        save.write(party);
        showLevelUpOverlay(spec, function () { enterScene(id); });
        return;
      }
    }

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
    // expose the "re-open map" button once the overworld era has begun (mapNode set)
    showMapButton(!!(party.mapNode));

    // Turn ownership: narrative CHOICE scenes rotate a "lead decider" between players.
    // Checks don't rotate the lead (the player picks WHO throws inside the check itself).
    var isChoiceScene = scene.choices && !scene.check && !scene.ending && !scene.combat;
    if (isChoiceScene) {
      if (typeof party.leadPlayer !== 'number') party.leadPlayer = 0; // first lead = Player 1
      else party.leadPlayer = (party.leadPlayer + 1) % party.heroes.length;
      party.activePlayer = party.leadPlayer; // keep hero-card highlight in sync
      save.write(party);
    }
    // (re)render both hero cards for the current party; the active player is highlighted
    renderParty(document.getElementById('scene-party'), party.activePlayer);
    var textEl = document.getElementById('scene-text');
    var actions = document.getElementById('scene-actions'); actions.innerHTML = '';
    textEl.onclick = function () { ui.skipTyping(textEl); };
    ui.typeParagraphs(textEl, sceneText(scene), { dropcap: scene.dropCap }, function () {
      if (scene.check) renderCheck(scene);
      else if (isChoiceScene && scene.coDecision && party.heroes.length === 2) {
        renderCoDecision(scene, actions);
      } else {
        if (isChoiceScene) showLeadBanner(actions, party.leadPlayer);
        renderSharedChoices(scene, actions);
      }
    });
  }

  // apply a chosen option's flags and move on
  function commitChoice(c) {
    audio.sfx.click();
    if (c.set) Object.keys(c.set).forEach(function (k) { state.setFlag(party, k, c.set[k]); });
    // world-map routing: a choice can open the map (`goToMap`) or return to it
    // after finishing a location (`returnToMap` + the node id in `mapDone`).
    if (c.returnToMap || c.mapDone) { returnFromLocation(c.mapDone); return; }
    // goToMap: open the overworld AT a node whose flavour intro just played, so
    // mark it done (its cluster is finished) — its neighbours become the choices.
    // Also close out the node the party physically came FROM (e.g. Зал колокола,
    // whose cluster flows boss → morven_truth → camp_act3 → crossroads → map):
    // otherwise it would stay "reachable" and let the player re-enter the fight.
    if (c.goToMap) {
      state.ensureMapState(party);
      if (party.mapNode && party.mapNode !== c.goToMap &&
          party.mapDone.indexOf(party.mapNode) < 0) {
        party.mapDone.push(party.mapNode);
      }
      returnFromLocation(c.goToMap);
      return;
    }
    enterScene(c.goto);
  }
  // normal shared choice list (the existing behavior, factored out for reuse)
  function renderSharedChoices(scene, host) {
    ui.renderChoices(host, scene.choices, party, commitChoice);
  }

  // ---------- split decision: "вы вдвоём решаете" ----------
  // Each player privately taps a preference; if they DISAGREE, a short reconciliation
  // screen invites them to choose together. Falls back gracefully to shared choices.
  function renderCoDecision(scene, host) {
    var visible = scene.choices.filter(function (c) { return ui.choiceVisible(c, party); });
    if (visible.length <= 1) { renderSharedChoices(scene, host); return; } // nothing to disagree about
    var prefs = [];

    function askPlayer(idx) {
      host.innerHTML = '';
      var banner = document.createElement('div'); banner.className = 'lead-banner';
      banner.innerHTML = '<span class="lead-dot">◆</span> Тайно решает: ' + playerLabel(idx) +
        ' — выбор увидит только он';
      host.appendChild(banner);
      var hint = document.createElement('p'); hint.className = 'flavor';
      hint.style.cssText = 'text-align:center;margin:4px 0 8px;';
      hint.textContent = 'Не показывай экран напарнику. Тапни, к чему склоняешься.';
      host.appendChild(hint);
      visible.forEach(function (c) {
        var b = document.createElement('button'); b.className = 'choice'; b.textContent = c.label;
        b.onclick = function () {
          audio.sfx.click();
          prefs[idx] = c;
          if (idx === 0) {
            // hand off to player 2 privately, then ask them
            passDevice(1, function () { askPlayer(1); }, { backTo: 'screen-scene' });
          } else {
            resolve();
          }
        };
        host.appendChild(b);
      });
    }

    function resolve() {
      if (prefs[0] && prefs[1] && prefs[0].goto === prefs[1].goto) {
        host.innerHTML = '';
        var ok = document.createElement('div'); ok.className = 'lead-banner';
        ok.innerHTML = '<span class="lead-dot">◆</span> Вы оба выбрали одно. Так тому и быть.';
        host.appendChild(ok);
        setTimeout(function () { commitChoice(prefs[0]); }, 700);
      } else {
        showReconciliation();
      }
    }

    // disagreement: name both preferences, then let them pick together
    function showReconciliation() {
      host.innerHTML = '';
      var box = document.createElement('div'); box.className = 'panel';
      box.style.cssText = 'text-align:center;font-family:\'Forum, Georgia, serif\';margin-bottom:10px;';
      box.innerHTML = '<b>Вы разошлись во мнениях.</b><br>' +
        playerLabel(0).split(' — ')[0] + ' хочет «' + prefs[0].label + '», ' +
        playerLabel(1).split(' — ')[0] + ' — «' + prefs[1].label + '».<br>' +
        'Обсудите и выберите вместе.';
      host.appendChild(box);
      var list = document.createElement('div'); host.appendChild(list);
      renderSharedChoices(scene, list); // shared list rendered below the note
    }

    // privately hand the device to player 1 first
    passDevice(0, function () { askPlayer(0); }, { backTo: 'screen-scene' });
  }

  // tasteful gold banner: who reads/decides this narrative scene (players still discuss)
  function showLeadBanner(host, leadIdx) {
    var h = party.heroes[leadIdx];
    var banner = document.createElement('div'); banner.className = 'lead-banner';
    banner.innerHTML = '<span class="lead-dot">◆</span> Решает: ' +
      'Игрок ' + (leadIdx + 1) + (h ? ' — ' + h.def.name : '');
    host.appendChild(banner);
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

  // difficulty value/key -> a plain Russian word the player understands at a glance
  var DIFF_WORDS = { easy: 'Легко', medium: 'Средне', hard: 'Сложно', veryHard: 'Очень сложно' };
  function diffWord(ch) {
    if (ch && DIFF_WORDS[ch.difficulty]) return DIFF_WORDS[ch.difficulty];
    var v = D.rules.DIFFICULTY[ch && ch.difficulty];
    if (typeof v !== 'number') return '';
    return v <= 8 ? 'Легко' : v <= 11 ? 'Средне' : v <= 14 ? 'Сложно' : 'Очень сложно';
  }

  // Player 1 owns heroes[0], Player 2 owns heroes[1]. "Игрок 1 — Бранд"
  function playerLabel(idx) {
    var h = party.heroes[idx];
    return 'Игрок ' + (idx + 1) + (h ? ' — ' + h.def.name : '');
  }

  // five dots showing a hero's stat (filled vs empty), as a tiny visual gauge
  function statDotsHTML(value) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= value) ? '●' : '<span class="off">●</span>';
    return '<span class="dots">' + s + '</span>';
  }

  // does this hero have the ability the check rewards? matched by id OR effect tag
  function heroHasAbility(def, tag) {
    if (!tag) return false;
    return def.abilities.some(function (a) { return a.id === tag || a.effect === tag; });
  }
  // a short success flavor line when the matching ability gives an edge
  var ABILITY_EDGE = {
    lockpick: 'нутром чувствует механизм…',
    persuade: 'находит верное слово…',
    tracking: 'читает скрытые тропы…',
    light: 'разгоняет тьму…'
  };

  // ---------- skill check: the player chooses WHO attempts it ----------
  function renderCheck(scene) {
    var actions = document.getElementById('scene-actions'); actions.innerHTML = '';
    var ch = scene.check;
    var statNameAcc = { str: 'Силу', dex: 'Ловкость', int: 'Ум', cha: 'Харизму' }[ch.stat];
    var word = diffWord(ch);

    // which of the two is better suited (higher stat) — highlighted, not forced
    var bestIdx = 0;
    party.heroes.forEach(function (h, i) {
      if (h.def.stats[ch.stat] > party.heroes[bestIdx].def.stats[ch.stat]) bestIdx = i;
    });

    var prompt = document.createElement('div'); prompt.className = 'check-prompt';
    prompt.textContent = (ch.label || 'Проверка') + ' — кто попробует?';
    actions.appendChild(prompt);

    party.heroes.forEach(function (hero, idx) {
      var def = hero.def;
      var hasEdge = heroHasAbility(def, ch.ability);
      var b = document.createElement('button');
      b.className = 'choice who-btn' + (idx === bestIdx ? ' suited' : '');
      var suitedTag = (idx === bestIdx) ? '<span class="who-suited-tag">подходит</span>' : '';
      var edgeLine = hasEdge
        ? '<span class="who-edge">' + def.name + ' ' + (ABILITY_EDGE[ch.ability] || 'знает это дело…') + '</span>'
        : '';
      b.innerHTML =
        '<span class="who-top"><span class="choice-label">' + def.name + suitedTag + '</span>' +
        '<span class="who-player">' + playerLabel(idx).split(' — ')[0] + '</span></span>' +
        '<span class="who-meta"><span>' + statNameAcc + ' ' + statDotsHTML(def.stats[ch.stat]) + '</span>' +
        '<span>' + (word || '') + '</span></span>' + edgeLine;
      b.onclick = function () {
        audio.sfx.click();
        // lock the whole prompt so a check resolves with exactly one hero
        var btns = actions.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
        attemptCheck(scene, idx, hasEdge);
      };
      actions.appendChild(b);
    });
  }

  // resolve the check for the chosen hero (keeps crit / partial / flag logic intact)
  function attemptCheck(scene, heroIdx, hasEdge) {
    var ch = scene.check;
    var statNameAcc = { str: 'Силу', dex: 'Ловкость', int: 'Ум', cha: 'Харизму' }[ch.stat];
    var hero = party.heroes[heroIdx];
    var extra = hasEdge ? 3 : 0;                       // ability edge: +3 to the roll
    // a story flag (e.g. the bard's ballad softened Морвен) can add a further bonus
    if (ch.extraFlag && party.flags[ch.extraFlag]) extra += (ch.extra || 0);
    var bonus = D.rules.statBonus(hero.def.stats[ch.stat]) + extra;
    var diff = D.rules.DIFFICULTY[ch.difficulty];
    var word = diffWord(ch);
    // name the throwing player on the dice overlay
    var prompt = playerLabel(heroIdx) + ' — бросок на ' + statNameAcc +
      (word ? ' · ' + word + ' (против ' + diff + ')' : '');
    D.diceThrow.roll({ prompt: prompt, onSettle: function (face) {
      var total = face + bonus;
      var crit = face === 20, critFail = face === 1;
      var mathSuccess = total >= diff;
      // nat 20 always succeeds, nat 1 always fails — they override the maths
      var success = crit ? true : (critFail ? false : mathSuccess);
      // near-miss: failed but within 2 below difficulty and not a natural 1
      var partial = !success && !critFail && total >= diff - 2;
      var res = {
        d20: face, bonus: bonus, total: total, difficulty: diff, diffWord: word,
        success: success, partial: partial, crit: crit, critFail: critFail,
        edge: (hasEdge && success) ? (hero.def.name + ' ' + (ABILITY_EDGE[ch.ability] || 'справился мастерски!')) : null
      };
      showDiceResult(document.getElementById('dice-tray'), res, function () {
        if (crit) {
          // critical boon: a small heal for the whole party, plus a flag the scene/UI can react to
          state.setFlag(party, 'critBoon', true);
          party.heroes.forEach(function (h) { if (state.healHero) state.healHero(h, 2); });
        }
        if (success) {
          if (ch.onSuccessSet) state.setFlag(party, ch.onSuccessSet, true);
          enterScene(ch.onSuccess);
        } else if (partial) {
          // fail-forward: route to success but mark a complication flag
          if (ch.onSuccessSet) state.setFlag(party, ch.onSuccessSet, true);
          state.setFlag(party, 'partial_' + (ch.onSuccessSet || scene.id), true);
          enterScene(ch.onSuccess);
        } else {
          // nat 1 also stamps the failure consequence even if maths would have passed
          if (ch.onFailSet) state.setFlag(party, ch.onFailSet, true);
          enterScene(ch.onFail);
        }
      });
    } });
  }

  function showDiceResult(tray, res, done) {
    var flourish = res.crit ? '<br><span style="color:#d4a853">Критический успех — 20!</span>'
                 : res.critFail ? '<br><span style="color:#8b0000">Роковая единица!</span>' : '';
    var verdict = res.success ? '<span style="color:#2e6b4f">Успех!</span>'
                : res.partial ? '<span style="color:#c08a2e">Успех ценой…</span>'
                : '<span style="color:#8b0000">Провал</span>';
    var diffLabel = res.diffWord ? res.diffWord + ' · против ' + res.difficulty : 'против ' + res.difficulty;
    var edge = res.edge ? '<br><span style="color:#7fc99b;font-style:italic">' + res.edge + '</span>' : '';
    tray.innerHTML = '<div class="panel" style="text-align:center;font-family:\'Forum, Georgia, serif\'">' +
      '🎲 ' + res.d20 + ' + ' + res.bonus + ' = <b>' + res.total + '</b> ' + diffLabel +
      '<br>' + verdict +
      flourish + edge + '</div>';
    setTimeout(function () { tray.innerHTML = ''; done(); }, res.edge ? 2000 : 1600);
  }

  // ---------- combat juice helpers (presentation only) ----------
  // Shake a stable full-bleed element (body) rather than the centered #screen-combat,
  // which would otherwise reveal edge gaps when it slides. Intensity 1..3 scales the
  // amplitude/duration via distinct CSS classes.
  var SHAKE_MS = { 1: 240, 2: 320, 3: 420 };
  function shake(intensity) {
    var lvl = intensity >= 3 ? 3 : intensity >= 2 ? 2 : 1;
    var el = document.body;
    if (!el) return;
    el.classList.remove('shaking-1', 'shaking-2', 'shaking-3');
    void el.offsetWidth; // force reflow so the animation can restart
    var cls = 'shaking-' + lvl;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, SHAKE_MS[lvl] + 20);
  }
  function flashHit(el) {
    if (!el) return;
    el.classList.remove('flash-hit');
    void el.offsetWidth;
    el.classList.add('flash-hit');
    setTimeout(function () { if (el) el.classList.remove('flash-hit'); }, 350);
  }
  // brief whiten + scale punch on a hit enemy's portrait (the blow "landing")
  function struck(panel) {
    if (!panel) return;
    var art = panel.querySelector ? panel.querySelector('.enemy-art') : null;
    if (!art) return;
    art.classList.remove('struck');
    void art.offsetWidth;
    art.classList.add('struck');
    setTimeout(function () { if (art) art.classList.remove('struck'); }, 260);
  }
  // floating combat number. opts: {big:Boolean, crit:Boolean} scale size/weight.
  function floatNumber(targetEl, text, color, opts) {
    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') return;
    opts = opts || {};
    var r = targetEl.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'float-num' + (opts.crit ? ' float-crit' : opts.big ? ' float-big' : '');
    el.textContent = text;
    el.style.color = color || '#fff';
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.top + r.height * 0.28) + 'px';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
  }
  // map a damage value to a shake intensity tier (1 subtle .. 3 strong)
  function dmgTier(dmg) { return dmg >= 8 ? 3 : dmg >= 4 ? 2 : 1; }
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
      audio.sfx.click();   // press feedback (the result SFX plays after the throw)
      var targetUid = firstEnemy.uid;
      D.diceThrow.roll({ prompt: 'Бросок на попадание', onSettle: function (face) {
        var r = combat.heroAttack(party, combatCtx.heroTurn, targetUid, Math.random, face);
        var panel = enemyPanel(targetUid);
        var crit = face === 20;   // a thrown 20 in combat is a crit
        if (r.hit) {
          audio.sfx.sword();
          // the blow "lands" instantly on the target, then a micro-freeze before
          // the screen shakes and the damage number flies up (hitstop).
          struck(panel);
          flashHit(panel);
          audio.haptic(crit ? [0, 30, 40, 60] : 20);
          var tier = crit ? 3 : dmgTier(r.damage);
          var stop = crit ? 130 : 70;
          setTimeout(function () {
            shake(tier);
            if (crit) floatNumber(panel, 'КРИТ! −' + r.damage, '#ffe9a8', { crit: true });
            else floatNumber(panel, '−' + r.damage, '#e8413a', { big: tier >= 2 });
          }, stop);
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
      // label line + small description subtitle for legibility
      var label = '✦ ' + ab.name + (left !== undefined ? ' (' + left + ')' : '');
      b.innerHTML = '<span class="choice-label">' + label + '</span>' +
        (ab.desc ? '<span class="choice-sub">' + ab.desc + '</span>' : '');
      b.disabled = (left === 0);
      b.onclick = function () {
        audio.sfx.click();   // press feedback before the ability's own SFX
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
          var ep = enemyPanel(enemyUid);
          var tier = dmgTier(r.damage);
          struck(ep);
          flashHit(ep);
          audio.haptic(20);
          shake(tier);
          floatNumber(ep, '−' + r.damage, '#e8413a', { big: tier >= 2 });
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
      var anyHit = false, worst = 0;
      party.heroes.forEach(function (h, i) {
        var delta = before[i] - h.hp;
        if (delta > 0) {
          anyHit = true;
          if (delta > worst) worst = delta;
          var hp = heroPanel(i);
          flashHit(hp);
          var tier = dmgTier(delta);
          floatNumber(hp, '−' + delta, '#e8413a', { big: tier >= 2 });
        }
      });
      if (anyHit) { audio.haptic(40); shake(dmgTier(worst)); }
      renderCombat();
    } else {
      // pass-device prompt between the two players — recap the last combat-log line
      var logLine = party.combat.log.length ? party.combat.log[party.combat.log.length - 1] : '';
      passDevice(combatCtx.heroTurn, function () { renderCombat(); }, { recap: logLine });
    }
  }

  // ---------- pass device ----------
  // Hand-off ritual: name the INCOMING player and their hero, optionally recap the
  // last thing that happened, then a single "Готово" the new holder taps.
  // opts: { recap: String, backTo: screen-id to show after (default 'screen-combat') }
  function passDevice(playerIndex, done, opts) {
    opts = opts || {};
    var hero = party.heroes[playerIndex];
    document.getElementById('pass-text').textContent =
      'Передайте устройство Игроку ' + (playerIndex + 1) + (hero ? ' — ' + hero.def.name : '');
    var recapEl = document.getElementById('pass-recap');
    if (recapEl) {
      if (opts.recap) { recapEl.textContent = opts.recap; recapEl.style.display = 'block'; }
      else { recapEl.textContent = ''; recapEl.style.display = 'none'; }
    }
    ui.show('screen-pass');
    document.getElementById('btn-pass-ok').onclick = function () {
      audio.sfx.click();
      ui.show(opts.backTo || 'screen-combat');
      done();
    };
  }

  // ====================================================================
  // ---------- 2.5D world map (overworld navigation hub) ----------
  // ====================================================================
  var mapCtx = {
    canvas: null, ctx: null, raf: null, t0: 0,
    nodes: [],          // live render list: {node, sx, sy(px), state}
    anim: null,         // active token glide {from, to, start, dur, onDone}
    bound: false        // pointer/resize listeners attached once
  };

  // --- fog / progression helpers (all guard old saves via ensureMapState) ---
  function mapDiscovered(id) { return party.discovered.indexOf(id) >= 0; }
  function mapIsDone(id) { return party.mapDone.indexOf(id) >= 0; }
  function revealNode(id) {
    if (WORLDMAP.byId(id) && party.discovered.indexOf(id) < 0) party.discovered.push(id);
  }
  // reveal a node and all its graph neighbours (fog lifts one step ahead)
  function revealAround(id) {
    revealNode(id);
    WORLDMAP.neighbors(id).forEach(revealNode);
  }
  // a node is reachable if: discovered, not yet done, has a real entry scene,
  // and is a direct graph neighbour of the node the token currently sits on.
  function mapReachable(id) {
    var n = WORLDMAP.byId(id);
    if (!n || !n.enter) return false;
    if (!mapDiscovered(id) || mapIsDone(id)) return false;
    return WORLDMAP.neighbors(party.mapNode || '').indexOf(id) >= 0;
  }

  // ENTER the map. nodeId = where the token sits now. reveal=true lifts fog
  // around it (its neighbours become visible & reachable). Plays an overworld mood.
  // The map is now the hub for the WHOLE game: Акты 1–3 nodes reveal progressively
  // as their clusters finish (no node is pre-marked done — the player walks them).
  function enterMap(nodeId, reveal) {
    state.ensureMapState(party);
    if (nodeId && WORLDMAP.byId(nodeId)) party.mapNode = nodeId;
    if (!party.mapNode) party.mapNode = 'tihiy_brod';
    revealNode(party.mapNode);
    if (reveal) revealAround(party.mapNode);
    party.sceneId = '__map__';   // Continue resumes on the map (enterScene re-routes)
    save.write(party);

    if (voice && voice.stop) voice.stop();   // no map narration — let the music breathe
    audio.playMusic('overworld');
    setSceneBg('assets/scenes/menu.jpg');    // warm parchment-ish backdrop behind the canvas
    ui.show('screen-map');
    document.getElementById('topbar').style.display = 'block';
    showMapButton(true);
    mapCtx.anim = null;
    setupMapCanvas();
    startMapLoop();
  }

  // finish a location's cluster: mark it done, plant the token there, lift fog
  // around it (the next leg becomes reachable), then show the map.
  function returnFromLocation(nodeId) {
    state.ensureMapState(party);
    if (nodeId && WORLDMAP.byId(nodeId)) {
      if (!mapIsDone(nodeId)) party.mapDone.push(nodeId);
      party.mapNode = nodeId;
    }
    enterMap(party.mapNode, true);
  }

  // --- canvas plumbing: size to the viewport at device pixel ratio, resize-safe ---
  function setupMapCanvas() {
    var cv = document.getElementById('map-canvas');
    mapCtx.canvas = cv;
    mapCtx.ctx = cv.getContext('2d');
    sizeMapCanvas();
    if (!mapCtx.bound) {
      mapCtx.bound = true;
      // single pointer handler covers mouse + touch + pen; touch-action:none (CSS)
      // stops the browser from scrolling/zooming the canvas under the finger.
      cv.addEventListener('pointerdown', onMapPointer);
      window.addEventListener('resize', function () {
        if (document.getElementById('screen-map').classList.contains('active')) {
          sizeMapCanvas(); drawMap();
        }
      });
    }
  }
  function sizeMapCanvas() {
    var cv = mapCtx.canvas; if (!cv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var r = cv.getBoundingClientRect();
    // fall back to the viewport if the element hasn't laid out yet (display races)
    var w = Math.max(1, Math.round(r.width || window.innerWidth));
    var h = Math.max(1, Math.round(r.height || (window.innerHeight - 48)));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    mapCtx.cssW = w; mapCtx.cssH = h; mapCtx.dpr = dpr;
  }
  // percent (0..100) -> CSS pixel coords inside the canvas (inset margin keeps
  // labels from clipping at the edges)
  function pctToPx(node) {
    var mx = 0.08, my = 0.10; // 8% / 10% inset
    var x = (mx + (node.x / 100) * (1 - 2 * mx)) * mapCtx.cssW;
    var y = (my + (node.y / 100) * (1 - 2 * my)) * mapCtx.cssH;
    return { x: x, y: y };
  }

  function startMapLoop() {
    if (mapCtx.raf) cancelAnimationFrame(mapCtx.raf);
    mapCtx.t0 = performance.now ? performance.now() : Date.now();
    var tick = function () {
      // stop looping the moment we leave the map (saves battery, avoids ghost draws)
      if (!document.getElementById('screen-map').classList.contains('active')) {
        mapCtx.raf = null; return;
      }
      drawMap();
      mapCtx.raf = requestAnimationFrame(tick);
    };
    mapCtx.raf = requestAnimationFrame(tick);
  }

  // --- the draw: parchment, ink paths, fog, markers, party token ---
  function drawMap() {
    var ctx = mapCtx.ctx; if (!ctx) return;
    var W = mapCtx.cssW, H = mapCtx.cssH, dpr = mapCtx.dpr;
    var now = (performance.now ? performance.now() : Date.now());
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1) aged parchment background (warm radial wash + dark vignette)
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.1,
                                     W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#caa86a');
    g.addColorStop(0.55, '#a8854f');
    g.addColorStop(1, '#5e451f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint ink grain — a sparse deterministic stipple, cheap and on-brand
    ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = '#2a1c0c';
    for (var i = 0; i < 90; i++) {
      var gx = ((i * 73) % 100) / 100 * W, gy = ((i * 137) % 100) / 100 * H;
      ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.restore();
    // dark edge vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(15,10,4,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // build the live node list (positions + visual state) for this frame
    var live = {};
    WORLDMAP.nodes.forEach(function (n) {
      var p = pctToPx(n);
      var st = !mapDiscovered(n.id) ? 'fog'
             : mapIsDone(n.id) ? 'done'
             : (n.id === party.mapNode) ? 'current'
             : mapReachable(n.id) ? 'reachable'
             : 'dim';
      live[n.id] = { node: n, x: p.x, y: p.y, state: st };
    });
    mapCtx.nodes = live;

    // 2) ink PATHS between connected nodes (only when both ends are discovered)
    WORLDMAP.edges.forEach(function (e) {
      var a = live[e[0]], b = live[e[1]];
      if (!a || !b) return;
      var aSeen = a.state !== 'fog', bSeen = b.state !== 'fog';
      if (!aSeen || !bSeen) return; // don't reveal where a path leads through fog
      var hot = (a.state === 'current' && b.state === 'reachable') ||
                (b.state === 'current' && a.state === 'reachable');
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash([1, 9]);              // dotted "traveller's trail"
      ctx.lineWidth = hot ? 3.2 : 2.2;
      ctx.strokeStyle = hot ? 'rgba(212,168,83,.95)' : 'rgba(60,40,18,.6)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    });

    // 3) markers
    WORLDMAP.nodes.forEach(function (n) {
      var L = live[n.id];
      drawNode(ctx, L, now);
    });

    // 4) party token (banner) — at the current node, or mid-glide during an anim
    drawToken(ctx, live, now);
  }

  function drawNode(ctx, L, now) {
    var x = L.x, y = L.y, st = L.state;
    if (st === 'fog') {
      // fog of war: a soft dark smudge where an undiscovered node hides
      ctx.save();
      var fg = ctx.createRadialGradient(x, y, 2, x, y, 26);
      fg.addColorStop(0, 'rgba(20,14,6,.55)'); fg.addColorStop(1, 'rgba(20,14,6,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    var R = 17;
    // reachable nodes gently pulse to invite a tap
    if (st === 'reachable') {
      var pulse = 0.5 + 0.5 * Math.sin(now / 360);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R + 6 + pulse * 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,168,83,' + (0.10 + pulse * 0.16) + ')';
      ctx.fill(); ctx.restore();
    }
    if (st === 'current') {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R + 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,200,90,.14)'; ctx.fill(); ctx.restore();
    }

    // gold ring + parchment disc
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = (st === 'done') ? 'rgba(46,107,79,.85)' : '#1c1107';
    ctx.fill();
    ctx.lineWidth = (st === 'current') ? 3.4 : 2.4;
    ctx.strokeStyle = (st === 'dim') ? 'rgba(212,168,83,.5)' : '#d4a853';
    ctx.globalAlpha = (st === 'dim') ? 0.7 : 1;
    ctx.stroke();
    ctx.restore();

    // icon (emoji) centred
    ctx.save();
    ctx.globalAlpha = (st === 'dim') ? 0.7 : 1;
    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st === 'done' ? '✓' : L.node.icon, x, y + 1);
    ctx.restore();

    // label in Forum below the marker
    ctx.save();
    ctx.font = "13px 'Forum', Georgia, serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.globalAlpha = (st === 'dim') ? 0.65 : 1;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,6,.85)';
    ctx.strokeText(L.node.label, x, y + R + 4);
    ctx.fillStyle = (st === 'current' || st === 'reachable') ? '#f4d27a' : '#2a1c0c';
    ctx.fillText(L.node.label, x, y + R + 4);
    ctx.restore();
  }

  // a small gold pennant marking the party's position (or mid-travel point)
  function drawToken(ctx, live, now) {
    var tx, ty;
    if (mapCtx.anim) {
      var a = mapCtx.anim;
      var p = Math.min(1, (now - a.start) / a.dur);
      // ease-in-out for a weighty glide
      var e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      var from = live[a.from], to = live[a.to];
      if (!from || !to) { mapCtx.anim = null; return; }
      tx = from.x + (to.x - from.x) * e;
      ty = from.y + (to.y - from.y) * e;
      if (p >= 1) {
        var done = a.onDone; mapCtx.anim = null;
        if (done) done();
        return;
      }
    } else {
      var cur = live[party.mapNode]; if (!cur) return;
      tx = cur.x; ty = cur.y;
    }
    var bob = Math.sin(now / 420) * 2;
    ty += bob - 26; // float the pennant above the node
    ctx.save();
    // pole
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + 22); ctx.stroke();
    // pennant
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(tx, ty); ctx.lineTo(tx + 18, ty + 5); ctx.lineTo(tx, ty + 11);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d4a853'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }

  // --- pointer hit-testing: screen coords -> node -> travel ---
  function onMapPointer(ev) {
    if (mapCtx.anim) return;                       // ignore taps mid-glide (no double-fire)
    var cv = mapCtx.canvas; if (!cv) return;
    var r = cv.getBoundingClientRect();
    var px = ev.clientX - r.left, py = ev.clientY - r.top; // CSS px inside the canvas
    var hit = null, hitDist = 1e9;
    var nodes = mapCtx.nodes || {};
    Object.keys(nodes).forEach(function (id) {
      var L = nodes[id];
      if (L.state === 'fog') return;
      var dx = px - L.x, dy = py - L.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 26 && d < hitDist) { hit = L; hitDist = d; }
    });
    if (!hit) return;
    if (mapReachable(hit.node.id)) { audio.sfx.click(); travelTo(hit.node); }
    else { flashMapHint(hit.state === 'fog' ? '' : 'Сейчас туда не пройти'); }
  }

  // glide the token from the current node to `node`, then enter its cluster
  function travelTo(node) {
    var from = party.mapNode;
    if (from === node.id || mapCtx.anim) return;
    setMapHint('В путь…');
    mapCtx.anim = {
      from: from, to: node.id,
      start: (performance.now ? performance.now() : Date.now()),
      dur: 820,
      onDone: function () {
        party.mapNode = node.id; save.write(party);
        // hand control to the location's scene cluster
        if (node.enter) { showMapButton(true); enterScene(node.enter); }
      }
    };
  }

  function showMapButton(on) {
    var b = document.getElementById('btn-map');
    if (b) b.style.display = on ? '' : 'none';
  }
  function setMapHint(msg) {
    var el = document.getElementById('map-hint'); if (el) el.textContent = msg;
  }
  var _hintTimer = null;
  function flashMapHint(msg) {
    if (!msg) return;
    setMapHint(msg);
    if (_hintTimer) clearTimeout(_hintTimer);
    _hintTimer = setTimeout(function () { setMapHint('Выберите, куда направиться'); }, 1600);
  }

  // ---------- ending ----------
  function enterEnding(scene) {
    audio.playMusic(scene.music || 'victory');
    document.getElementById('topbar').style.display = 'none';
    ui.show('screen-ending');
    var el = document.getElementById('ending-text');
    ui.typeParagraphs(el, sceneText(scene), { dropcap: true });
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
