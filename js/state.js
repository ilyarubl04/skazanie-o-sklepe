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
    return { heroes: heroes, activePlayer: 0, sceneId: 'start', flags: {}, inventory: [], combat: null };
  };

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
