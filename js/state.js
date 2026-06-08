(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var HEROES = root.DnD.HEROES;
  var state = {};

  function findHero(id) {
    for (var i = 0; i < HEROES.length; i++) if (HEROES[i].id === id) return HEROES[i];
    throw new Error('unknown hero: ' + id);
  }

  state.createParty = function (heroIds) {
    var heroes = heroIds.map(function (id) {
      var def = findHero(id);
      var uses = {};
      def.abilities.forEach(function (a) { if (a.uses !== 'unlimited') uses[a.id] = a.uses; });
      return {
        id: def.id, def: def,
        hp: def.maxHp, maxHp: def.maxHp,
        abilityUses: uses, statuses: [], downed: false
      };
    });
    return {
      heroes: heroes, activePlayer: 0, sceneId: 'start', flags: {},
      inventory: [], combat: null, upgrades: {}, level: 0,
      // ---- world-map state (Act 3+ overworld navigation) ----
      mapNode: null,        // id of the node the token currently sits on
      discovered: [],       // ids of revealed (non-fogged) nodes
      mapDone: []           // ids of locations whose cluster is finished
    };
  };

  // guard old saves that predate the world-map fields (called on load + before use)
  state.ensureMapState = function (party) {
    if (!party) return party;
    if (!('mapNode' in party)) party.mapNode = null;
    if (!Array.isArray(party.discovered)) party.discovered = [];
    if (!Array.isArray(party.mapDone)) party.mapDone = [];
    return party;
  };

  // ---- hero progression (campaign level-ups between acts) ----
  // each upgrade record: { extraUses:{abilityId:n}, atkDieBonus, defBonus }
  function upgradeRec(party, heroId) {
    if (!party.upgrades) party.upgrades = {};
    if (!party.upgrades[heroId]) {
      party.upgrades[heroId] = { extraUses: {}, atkDieBonus: 0, defBonus: 0 };
    }
    var r = party.upgrades[heroId];
    if (!r.extraUses) r.extraUses = {};
    if (typeof r.atkDieBonus !== 'number') r.atkDieBonus = 0;
    if (typeof r.defBonus !== 'number') r.defBonus = 0;
    return r;
  }

  // the strongest combat ability = the damaging ability with the highest base uses.
  function bestCombatAbility(def) {
    var combatEffects = { damage: 1, damage_bonus: 1, guaranteed_hit: 1, double_next: 1 };
    var best = null, bestUses = -1;
    def.abilities.forEach(function (a) {
      if (!combatEffects[a.effect]) return;
      var u = (a.uses === 'unlimited') ? 0 : (a.uses || 0);
      if (u > bestUses) { bestUses = u; best = a; }
    });
    // fallback: any limited-use ability if none of the above matched
    if (!best) {
      def.abilities.forEach(function (a) {
        if (a.uses === 'unlimited') return;
        var u = a.uses || 0;
        if (u > bestUses) { bestUses = u; best = a; }
      });
    }
    return best;
  }

  // apply a level-up spec to the whole party. AUTO parts only (choice handled later).
  // spec example: { hp: 6, uses: 'bestCombat', choice: null }
  state.applyLevelUp = function (party, spec) {
    spec = spec || {};
    party.heroes.forEach(function (hero) {
      if (spec.hp) {
        hero.maxHp += spec.hp;
        hero.hp = hero.maxHp;
        hero.downed = false;
      } else {
        // heal-to-full on a level-up even with no hp bump
        hero.hp = hero.maxHp;
        hero.downed = false;
      }
      if (spec.uses === 'bestCombat') {
        var ab = bestCombatAbility(hero.def);
        if (ab) {
          var rec = upgradeRec(party, hero.id);
          rec.extraUses[ab.id] = (rec.extraUses[ab.id] || 0) + 1;
        }
      }
    });
    party.level = (party.level || 0) + 1;
    return party;
  };

  state.heroAtkBonus = function (party, heroId) {
    if (!party.upgrades || !party.upgrades[heroId]) return 0;
    return party.upgrades[heroId].atkDieBonus || 0;
  };
  state.heroDefBonus = function (party, heroId) {
    if (!party.upgrades || !party.upgrades[heroId]) return 0;
    return party.upgrades[heroId].defBonus || 0;
  };
  state.upgradeRec = upgradeRec;

  state.damageHero = function (hero, amount) {
    hero.hp = Math.max(0, hero.hp - amount);
    if (hero.hp === 0) hero.downed = true;
    return hero.hp;
  };
  state.healHero = function (hero, amount) {
    if (hero.hp > 0 || amount > 0) hero.downed = false;
    hero.hp = Math.min(hero.maxHp, hero.hp + amount);
    return hero.hp;
  };

  state.setFlag = function (p, key, val) { p.flags[key] = val; };
  state.getFlag = function (p, key) { return p.flags[key]; };

  state.partyWiped = function (p) {
    return p.heroes.every(function (h) { return h.downed; });
  };

  root.DnD.state = state;
  if (typeof module !== 'undefined' && module.exports) module.exports = state;
})(typeof window !== 'undefined' ? window : global);
