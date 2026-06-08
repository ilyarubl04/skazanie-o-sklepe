'use strict';
require('../js/dice.js'); require('../js/rules.js');
require('../js/heroes.js'); require('../js/bestiary.js');
require('../js/state.js');
var combat = require('../js/combat.js');
var state = require('../js/state.js');

function maxRng() { return function () { return 0.999; }; }
function minRng() { return function () { return 0; }; }

// --- test-only multi-phase boss injected into the bestiary (does not ship) ---
// Phase 0 (>66%): plain melee.  Phase 1 (66–33%): AoE wave + summon wraith.
// Phase 2 (<33%): enrage + faster wave. Mirrors the shepherd's shape.
var ENEMIES = (typeof window !== 'undefined' ? window : global).DnD.ENEMIES;
ENEMIES.test_phaser = {
  id: 'test_phaser', name: 'Многоликий', art: '',
  maxHp: 100, defense: 8, attack: { bonus: 9, damage: 'd6' },
  boss: true,
  special: {
    summon: 'skeleton', summonEvery: 99, // base cadence rare, phases override
    phases: [
      { at: 0.66, wave: 'd8', waveEvery: 3, summon: 'wraith', summonEvery: 3 },
      { at: 0.33, enrage: true, wave: 'd8', waveEvery: 2 }
    ]
  }
};

test('startCombat creates enemy instances with hp', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }, { type: 'skeleton' }]);
  assertEqual(p.combat.enemies.length, 2);
  assertEqual(p.combat.enemies[0].hp, 12);
  assertEqual(p.combat.status, 'ongoing');
});
test('heroAttack with high roll hits and damages enemy', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var enemyId = p.combat.enemies[0].uid;
  var res = combat.heroAttack(p, 0, enemyId, maxRng());
  assertEqual(res.hit, true);
  assert(p.combat.enemies[0].hp < 12, 'enemy took damage');
});
test('heroAttack with fixedD20=20 is a guaranteed hit and natural 20', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  var res = combat.heroAttack(p, 0, uid, minRng(), 20); // min rng => min damage, still hits
  assertEqual(res.hit, true);
  assert(p.combat.enemies[0].hp < 12, 'enemy took damage on natural 20');
});
test('heroAttack with low fixedD20 misses a high-defense enemy', function () {
  var p = state.createParty(['brand', 'lira']);
  // morven is the boss with a high defense; a 2 + small bonus cannot reach it
  combat.startCombat(p, [{ type: 'morven' }]);
  var uid = p.combat.enemies[0].uid;
  var before = p.combat.enemies[0].hp;
  var res = combat.heroAttack(p, 0, uid, maxRng(), 2);
  assertEqual(res.hit, false);
  assertEqual(p.combat.enemies[0].hp, before, 'enemy unharmed on a miss');
});
test('killing all enemies sets status won', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'wolf' }]);
  var uid = p.combat.enemies[0].uid;
  // wolf has 10 hp; brand d8+3 max=11 -> dies in one max hit
  combat.heroAttack(p, 0, uid, maxRng());
  assertEqual(combat.combatStatus(p), 'won');
});
test('enemiesTurn can down a hero and partyWiped triggers lost', function () {
  var p = state.createParty(['lira', 'lira']);
  // both fragile mages 20hp; give enemy guaranteed hits with maxRng repeatedly
  combat.startCombat(p, [{ type: 'morven' }]);
  for (var i = 0; i < 30 && combat.combatStatus(p) !== 'lost'; i++) {
    combat.enemiesTurn(p, maxRng());
  }
  assertEqual(combat.combatStatus(p), 'lost');
});
test('turn_undead ability damages undead enemies', function () {
  var p = state.createParty(['mira', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  var before = p.combat.enemies[0].hp;
  combat.heroAbility(p, 0, 'turn_undead', uid, maxRng());
  assert(p.combat.enemies[0].hp < before || p.combat.enemies[0].fled, 'undead affected');
  assertEqual(p.heroes[0].abilityUses.turn_undead, 1);
});
test('heal ability restores a downed ally', function () {
  var p = state.createParty(['mira', 'brand']);
  state.damageHero(p.heroes[1], 999);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'heal', p.heroes[1].id, maxRng());
  assert(p.heroes[1].hp > 0, 'ally healed');
  assertEqual(p.heroes[1].downed, false);
});

// ---- per-combat reset (fix 1) ----
test('startCombat resets ability uses and clears statuses each fight', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  combat.heroAbility(p, 0, 'fireball', uid, maxRng());      // spend a fireball
  combat.heroAbility(p, 1, 'bless', p.heroes[0].id, maxRng()); // apply a buff status
  assertEqual(p.heroes[0].abilityUses.fireball, 2);
  assert(p.heroes[0].statuses.length > 0, 'buff applied before reset');
  combat.startCombat(p, [{ type: 'skeleton' }]);            // new fight
  assertEqual(p.heroes[0].abilityUses.fireball, 3, 'fireball refilled');
  assertEqual(p.heroes[0].statuses.length, 0, 'statuses cleared');
});

// ---- nil-guard target lookups (fix 2) ----
test('heroAttack on unknown uid returns invalid and does not throw', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var res = combat.heroAttack(p, 0, 'nope-uid', maxRng());
  assertEqual(res.hit, false);
  assertEqual(res.invalid, true);
});
test('heroAttack on an already-dead enemy returns invalid, not a hit', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'wolf' }, { type: 'skeleton' }]);
  var deadUid = p.combat.enemies[0].uid;
  combat.heroAttack(p, 0, deadUid, maxRng()); // kill the wolf (10hp, d8+3 max=11)
  assert(p.combat.enemies[0].hp <= 0, 'wolf dead');
  var res = combat.heroAttack(p, 1, deadUid, maxRng()); // attack the corpse
  assertEqual(res.invalid, true);
  assertEqual(res.hit, false);
});

// ---- no-op instead of throw for unusable abilities (fix 3) ----
test('heroAbility with no uses left returns invalid, does not throw or go negative', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  p.heroes[0].abilityUses.fireball = 0;
  var res = combat.heroAbility(p, 0, 'fireball', uid, maxRng());
  assertEqual(res.invalid, true);
  assertEqual(p.heroes[0].abilityUses.fireball, 0);
});
test('heroAbility with unknown id returns invalid and does not throw', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var res = combat.heroAbility(p, 0, 'no_such_ability', p.combat.enemies[0].uid, maxRng());
  assertEqual(res.invalid, true);
});

// ---- buff_rolls (bless/inspire) actually boosts to-hit ----
test('bless adds its value to the blessed hero to-hit and lands a borderline hit', function () {
  // brand bonus 5; skeleton defense — pick a fixedD20 that misses without bless but hits with +2.
  var p = state.createParty(['mira', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var def = p.combat.enemies[0].defense;
  // choose face so that face+5 < def but face+5+2 >= def
  var face = def - 5 - 1; // misses by 1 without bless
  var uid = p.combat.enemies[0].uid;
  // without bless: miss
  var miss = combat.heroAttack(p, 1, uid, minRng(), face);
  assertEqual(miss.hit, false);
  // now bless brand (+2) then attack with same face: should hit
  combat.heroAbility(p, 0, 'bless', p.heroes[1].id, maxRng());
  var hit = combat.heroAttack(p, 1, uid, minRng(), face);
  assertEqual(hit.hit, true);
});

// ---- summon_ally (animal_call): the beast strikes enemies ----
test('animal_call summons a beast that damages an enemy and expires after 2 rounds', function () {
  var p = state.createParty(['thea', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'animal_call', null, maxRng());
  assert(p.combat.ally && p.combat.ally.turns === 2, 'ally summoned with 2 turns');
  var before = p.combat.enemies[0].hp;
  combat.enemiesTurn(p, maxRng());
  assert(p.combat.enemies[0].hp < before, 'beast damaged the enemy');
  assertEqual(p.combat.ally.turns, 1, 'ally turns decremented');
  combat.enemiesTurn(p, maxRng());
  assert(!p.combat.ally, 'ally gone after 2 rounds');
});

// ---- smarter AI: enemies focus the lowest-current-HP non-downed hero ----
test('enemy focuses the lower-HP hero instead of a random one', function () {
  var p = state.createParty(['brand', 'brand']); // identical defense so HP is the only difference
  state.damageHero(p.heroes[0], 10);             // hero 0 is now the weaker target
  combat.startCombat(p, [{ type: 'skeleton' }]);
  // maxRng would make uniform-random pick index 1 (the HEALTHY hero); focus must override that
  var lowBefore = p.heroes[0].hp, highBefore = p.heroes[1].hp;
  combat.enemiesTurn(p, maxRng());               // maxRng => the lone skeleton always hits
  assert(p.heroes[0].hp < lowBefore, 'low-HP hero took the hit');
  assertEqual(p.heroes[1].hp, highBefore, 'high-HP hero was spared');
});

// ---- Morven's dark wave AoE hits BOTH heroes on a wave turn ----
test('Morven unleashes a dark wave that damages both non-downed heroes', function () {
  var p = state.createParty(['brand', 'thea']); // sturdy enough to survive a few rounds
  combat.startCombat(p, [{ type: 'morven' }]);
  var sawWave = false;
  for (var i = 0; i < 3 && !sawWave; i++) {
    var before = p.heroes.map(function (h) { return h.hp; });
    var logLen = p.combat.log.length;
    combat.enemiesTurn(p, maxRng());
    var waveLogged = p.combat.log.slice(logLen).some(function (l) { return /тёмную волну/.test(l); });
    if (waveLogged) {
      sawWave = true;
      assert(p.heroes[0].hp < before[0], 'hero 0 took wave damage');
      assert(p.heroes[1].hp < before[1], 'hero 1 took wave damage');
    }
  }
  assert(sawWave, 'a wave turn occurred within the first 3 boss turns');
});

// ---- boss AoE/targeting must not crash when one hero is already downed ----
test('boss turn with one hero downed does not throw and spares the downed hero', function () {
  var p = state.createParty(['brand', 'lira']);
  state.damageHero(p.heroes[1], 999); // Lira is downed
  combat.startCombat(p, [{ type: 'morven' }]);
  for (var i = 0; i < 4; i++) combat.enemiesTurn(p, maxRng()); // includes a wave turn
  assert(p.heroes[1].downed, 'downed hero stays down (not revived/targeted)');
});

// ---- boss phases / enrage (Stage 0) ----
test('boss with phaseAt becomes phased below the threshold and logs ярость', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'bone_golem' }]);
  var golem = p.combat.enemies[0];
  assert(!golem.phased, 'not phased while above half HP');
  golem.hp = Math.floor(golem.maxHp * 0.4); // drop below 50%
  var logLen = p.combat.log.length;
  combat.enemiesTurn(p, maxRng());
  assertEqual(golem.phased, true, 'phased once below threshold');
  assert(p.combat.log.slice(logLen).some(function (l) { return /входит в ярость/.test(l); }), 'enrage logged');
});
test('enraged boss deals more melee damage than the same roll un-enraged', function () {
  // un-enraged baseline: golem above threshold, maxRng so it always hits
  var a = state.createParty(['brand', 'brand']);
  combat.startCombat(a, [{ type: 'bone_golem' }]);
  var beforeA = a.heroes.map(function (h) { return h.hp; });
  combat.enemiesTurn(a, maxRng());
  var dmgA = Math.max(beforeA[0] - a.heroes[0].hp, beforeA[1] - a.heroes[1].hp);
  // enraged: drop below threshold first
  var b = state.createParty(['brand', 'brand']);
  combat.startCombat(b, [{ type: 'bone_golem' }]);
  b.combat.enemies[0].hp = Math.floor(b.combat.enemies[0].maxHp * 0.4);
  var beforeB = b.heroes.map(function (h) { return h.hp; });
  combat.enemiesTurn(b, maxRng());
  var dmgB = Math.max(beforeB[0] - b.heroes[0].hp, beforeB[1] - b.heroes[1].hp);
  assert(dmgB > dmgA, 'enraged hit (' + dmgB + ') harder than normal (' + dmgA + ')');
});
test('a boss without phaseAt (Morven) never becomes phased', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'morven' }]);
  p.combat.enemies[0].hp = 1; // far below any fraction
  combat.enemiesTurn(p, maxRng());
  assert(!p.combat.enemies[0].phased, 'non-phase boss stays unphased');
});

// ---- progression upgrades applied in combat (Stage 0) ----
test('extraUses from a level-up grant more ability uses after startCombat', function () {
  var p = state.createParty(['lira', 'brand']);
  state.applyLevelUp(p, { hp: 6, uses: 'bestCombat' }); // +1 fireball use recorded
  combat.startCombat(p, [{ type: 'skeleton' }]);
  assertEqual(p.heroes[0].abilityUses.fireball, 4, 'base 3 + 1 from level-up');
});
test('atkDieBonus adds flat damage to a hero attack', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'morven' }]); // big hp so it survives
  var uid = p.combat.enemies[0].uid;
  var hpBefore = p.combat.enemies[0].hp;
  combat.heroAttack(p, 0, uid, minRng(), 20); // min dmg roll (d8+3 -> 4), nat 20 hit
  var dmgNoBonus = hpBefore - p.combat.enemies[0].hp;
  // now with +3 atk bonus, same min roll + nat 20
  var p2 = state.createParty(['brand', 'lira']);
  state.upgradeRec(p2, 'brand').atkDieBonus = 3;
  combat.startCombat(p2, [{ type: 'morven' }]);
  var uid2 = p2.combat.enemies[0].uid;
  var hpBefore2 = p2.combat.enemies[0].hp;
  combat.heroAttack(p2, 0, uid2, minRng(), 20);
  var dmgWithBonus = hpBefore2 - p2.combat.enemies[0].hp;
  assertEqual(dmgWithBonus, dmgNoBonus + 3, 'atkDieBonus adds 3 damage');
});
test('defBonus raises a hero defense and can turn a hit into a miss', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var base = combat.heroDefense(p.heroes[0]); // no party => base only
  assertEqual(combat.heroDefense(p.heroes[0], p), base, 'no upgrade => unchanged');
  state.upgradeRec(p, 'brand').defBonus = 4;
  assertEqual(combat.heroDefense(p.heroes[0], p), base + 4, 'defBonus added');
});

// ---- guard_ally (Brand's guard): redirects a hit to the guardian ----
test('guard redirects an enemy hit from the ally to Brand, then is consumed', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'guard', null, maxRng());
  var brandHpBefore = p.heroes[0].hp;
  var liraHpBefore = p.heroes[1].hp;
  combat.enemiesTurn(p, maxRng()); // maxRng => enemy hits
  assert(p.heroes[1].hp === liraHpBefore, 'ally (Lira) unharmed — hit redirected');
  assert(p.heroes[0].hp < brandHpBefore, 'guardian (Brand) took the damage');
  var stillGuarding = p.heroes[0].statuses.some(function (s) { return s.type === 'guard'; });
  assertEqual(stillGuarding, false, 'guard consumed');
});

// ---- multi-phase final boss (Stage 5: special.phases) ----
test('multi-phase boss starts at phaseIndex 0 and does not transition above the first threshold', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'test_phaser' }]);
  var boss = p.combat.enemies[0];
  assertEqual(boss.phaseIndex || 0, 0, 'no phase entered while full HP');
  combat.enemiesTurn(p, maxRng());
  assertEqual(boss.phaseIndex || 0, 0, 'still phase 0 above 66%');
  assert(!boss.phased, 'phases path does not set the legacy phased flag');
});
test('multi-phase boss enters phase 1 below 66% and logs a flavor line', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'test_phaser' }]);
  var boss = p.combat.enemies[0];
  boss.hp = Math.floor(boss.maxHp * 0.6); // below 66%, above 33%
  var logLen = p.combat.log.length;
  combat.enemiesTurn(p, maxRng());
  assertEqual(boss.phaseIndex, 1, 'advanced to phase 1');
  assert(p.combat.log.slice(logLen).length > 0, 'a phase-transition line was logged');
});
test('multi-phase boss enters phase 2 below 33% with enrage', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'test_phaser' }]);
  var boss = p.combat.enemies[0];
  boss.hp = Math.floor(boss.maxHp * 0.2); // below 33%
  combat.enemiesTurn(p, maxRng());
  assertEqual(boss.phaseIndex, 2, 'jumped straight to phase 2 (catches up past skipped thresholds)');
});
test('multi-phase boss unleashes its AoE wave in phase 1 (both heroes hit on a wave turn)', function () {
  var p = state.createParty(['brand', 'brand']); // sturdy
  combat.startCombat(p, [{ type: 'test_phaser' }]);
  var boss = p.combat.enemies[0];
  boss.hp = Math.floor(boss.maxHp * 0.6); // in phase 1
  var sawWave = false;
  for (var i = 0; i < 4 && !sawWave; i++) {
    boss.hp = Math.floor(boss.maxHp * 0.6); // keep it in phase 1 across turns
    var before = p.heroes.map(function (h) { return h.hp; });
    var logLen = p.combat.log.length;
    combat.enemiesTurn(p, maxRng());
    if (p.combat.log.slice(logLen).some(function (l) { return /волн/.test(l); })) {
      sawWave = true;
      assert(p.heroes[0].hp < before[0] && p.heroes[1].hp < before[1], 'wave hit both heroes');
    }
  }
  assert(sawWave, 'phase-1 boss eventually unleashes its wave');
});
test('multi-phase boss summons its phase-specific minion (wraith) in phase 1', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'test_phaser' }]);
  var boss = p.combat.enemies[0];
  var hadWraith = false;
  for (var i = 0; i < 6 && !hadWraith; i++) {
    boss.hp = Math.floor(boss.maxHp * 0.5); // keep in phase 1
    combat.enemiesTurn(p, maxRng());
    hadWraith = p.combat.enemies.some(function (e) { return e.type === 'wraith'; });
  }
  assert(hadWraith, 'phase-1 boss summons a wraith');
});
test('multi-phase boss deals more melee in the enraged phase 2 than in phase 0', function () {
  // phase-0 baseline melee
  var a = state.createParty(['brand', 'brand']);
  combat.startCombat(a, [{ type: 'test_phaser' }]);
  var beforeA = a.heroes.map(function (h) { return h.hp; });
  combat.enemiesTurn(a, maxRng());
  var dmgA = Math.max(beforeA[0] - a.heroes[0].hp, beforeA[1] - a.heroes[1].hp);
  // phase-2 enraged melee (force a melee turn, not a wave turn, by using turnCount parity)
  var b = state.createParty(['brand', 'brand']);
  combat.startCombat(b, [{ type: 'test_phaser' }]);
  var bossB = b.combat.enemies[0];
  bossB.hp = Math.floor(bossB.maxHp * 0.2); // phase 2
  // advance to phase 2 first (this turn) without measuring, then measure a melee turn
  var meleeDmg = 0;
  for (var t = 0; t < 6 && meleeDmg === 0; t++) {
    bossB.hp = Math.floor(bossB.maxHp * 0.2);
    var bb = b.heroes.map(function (h) { return h.hp; });
    var ll = b.combat.log.length;
    combat.enemiesTurn(b, maxRng());
    var wasWave = b.combat.log.slice(ll).some(function (l) { return /волн/.test(l); });
    if (!wasWave) meleeDmg = Math.max(bb[0] - b.heroes[0].hp, bb[1] - b.heroes[1].hp);
  }
  assert(meleeDmg > dmgA, 'enraged phase-2 melee (' + meleeDmg + ') beats phase-0 (' + dmgA + ')');
});
test('a boss WITHOUT phases (Morven) is unchanged by the multi-phase code', function () {
  var p = state.createParty(['brand', 'thea']);
  combat.startCombat(p, [{ type: 'morven' }]);
  var boss = p.combat.enemies[0];
  boss.hp = 1;
  combat.enemiesTurn(p, maxRng());
  assertEqual(boss.phaseIndex || 0, 0, 'no phaseIndex on a phase-less boss');
  assert(!boss.phased, 'Morven never becomes phased');
});
