(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var dice = root.DnD.dice;
  var ENEMIES = root.DnD.ENEMIES;
  var state = root.DnD.state;
  var combat = {};

  var uidCounter = 0;
  function makeEnemy(spec) {
    var def = ENEMIES[spec.type];
    if (!def) throw new Error('unknown enemy ' + spec.type);
    uidCounter++;
    return {
      uid: 'e' + uidCounter, type: def.id, name: def.name, def: def,
      hp: def.maxHp, maxHp: def.maxHp, defense: def.defense,
      undead: !!def.undead, boss: !!def.boss, fled: false, turnCount: 0
    };
  }

  combat.startCombat = function (party, enemySpecs) {
    // per-combat reset: refill ability uses and drop leftover statuses from prior fights
    (party.heroes || []).forEach(function (hero) {
      var uses = {};
      hero.def.abilities.forEach(function (a) { if (a.uses !== 'unlimited') uses[a.id] = a.uses; });
      hero.abilityUses = uses;
      hero.statuses = [];
    });
    party.combat = {
      enemies: enemySpecs.map(makeEnemy),
      round: 1, status: 'ongoing', log: []
    };
    return party.combat;
  };

  function aliveEnemies(c) { return c.enemies.filter(function (e) { return e.hp > 0 && !e.fled; }); }
  function findEnemy(c, uid) { return c.enemies.filter(function (e) { return e.uid === uid; })[0]; }
  function validTarget(enemy) { return !!enemy && enemy.hp > 0 && !enemy.fled; }

  combat.combatStatus = function (party) {
    var c = party.combat;
    if (!c) return 'none';
    if (aliveEnemies(c).length === 0) { c.status = 'won'; return 'won'; }
    if (state.partyWiped(party)) { c.status = 'lost'; return 'lost'; }
    return 'ongoing';
  };

  function applyDamageToEnemy(c, enemy, amount, log) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    log.push(enemy.name + ' получает ' + amount + ' урона.');
  }

  combat.heroAttack = function (party, heroIndex, targetUid, rng, fixedD20) {
    var c = party.combat;
    var hero = party.heroes[heroIndex];
    var enemy = findEnemy(c, targetUid);
    if (!validTarget(enemy)) return { hit: false, invalid: true };
    var atk = hero.def.attack;
    var bonus = atk.bonus + statusAtkBonus(hero);
    var toHit;
    if (typeof fixedD20 === 'number') {
      // a player-thrown d20 supplies the to-hit die; bonus is applied here
      toHit = {
        rolls: [fixedD20],
        total: fixedD20 + bonus,
        natural: fixedD20 === 20 ? 20 : (fixedD20 === 1 ? 1 : undefined)
      };
    } else {
      toHit = dice.rollD20(bonus, rng);
    }
    var res = { hit: false, roll: toHit.total };
    if (toHit.total >= enemy.defense || toHit.natural === 20) {
      var dmg = dice.roll(atk.damage, rng);
      var total = dmg.total * (consumeDouble(hero) ? 2 : 1);
      applyDamageToEnemy(c, enemy, total, c.log);
      res.hit = true; res.damage = total;
    } else {
      c.log.push(hero.def.name + ' промахивается по ' + enemy.name + '.');
    }
    combat.combatStatus(party);
    return res;
  };

  combat.heroAbility = function (party, heroIndex, abilityId, targetUid, rng) {
    var c = party.combat;
    var hero = party.heroes[heroIndex];
    var ability = hero.def.abilities.filter(function (a) { return a.id === abilityId; })[0];
    if (!ability) return { ability: abilityId, invalid: true };
    if (ability.uses !== 'unlimited' && !hero.abilityUses[abilityId]) return { ability: abilityId, invalid: true };
    // enemy-targeting effects need a valid enemy before a use is spent
    var enemyTargeting = { damage: 1, damage_bonus: 1, turn_undead: 1, guaranteed_hit: 1, debuff_attack: 1 };
    if (enemyTargeting[ability.effect] && !validTarget(findEnemy(c, targetUid))) return { ability: abilityId, invalid: true };
    if (ability.uses !== 'unlimited') hero.abilityUses[abilityId]--;
    var res = { ability: abilityId };
    switch (ability.effect) {
      case 'damage':
      case 'damage_bonus': {
        var enemy = findEnemy(c, targetUid);
        var d = dice.roll(ability.damage, rng);
        applyDamageToEnemy(c, enemy, d.total, c.log);
        res.damage = d.total; break;
      }
      case 'turn_undead': {
        var en = findEnemy(c, targetUid);
        if (en.undead) {
          if (en.boss) { applyDamageToEnemy(c, en, dice.roll('d8+4', rng).total, c.log); }
          else { en.fled = true; c.log.push(en.name + ' бежит прочь от святого света!'); }
        } else { c.log.push('Изгнание не действует на живых.'); }
        break;
      }
      case 'heal': {
        var allyId = targetUid;
        var ally = party.heroes.filter(function (h) { return h.id === allyId; })[0] || party.heroes[heroIndex];
        var amt = dice.roll(ability.amount, rng).total;
        state.healHero(ally, amt);
        res.heal = amt; c.log.push(ally.def.name + ' исцелён на ' + amt + ' HP.'); break;
      }
      case 'guaranteed_hit': {
        var t = findEnemy(c, targetUid);
        var base = dice.roll(hero.def.attack.damage, rng).total;
        var extra = dice.roll(ability.damage, rng).total;
        applyDamageToEnemy(c, t, base + extra, c.log);
        res.damage = base + extra; break;
      }
      case 'debuff_attack': {
        var de = findEnemy(c, targetUid);
        var dm = dice.roll(ability.damage, rng).total;
        applyDamageToEnemy(c, de, dm, c.log);
        de.atkPenalty = (de.atkPenalty || 0) + 2; res.damage = dm; break;
      }
      case 'double_next': hero.statuses.push({ type: 'double_next' }); break;
      case 'buff_attack_party': party.heroes.forEach(function (h) { h.statuses.push({ type: 'atk', value: 2, turns: 2 }); }); break;
      case 'buff_defense': { var tgt = party.heroes.filter(function (h){return h.id===targetUid;})[0]||hero; tgt.statuses.push({ type: 'def', value: 4, turns: 2 }); break; }
      case 'buff_rolls': { var tg = party.heroes.filter(function (h){return h.id===targetUid;})[0]||hero; tg.statuses.push({ type: 'roll', value: (abilityId==='inspire'?3:2), turns: 3 }); break; }
      case 'summon_ally': c.allySummon = { turns: 2 }; break;
      default: break; // utility handled outside combat
    }
    combat.combatStatus(party);
    return res;
  };

  function statusAtkBonus(hero) {
    var b = 0; hero.statuses.forEach(function (s) { if (s.type === 'atk') b += s.value; }); return b;
  }
  function consumeDouble(hero) {
    for (var i = 0; i < hero.statuses.length; i++) {
      if (hero.statuses[i].type === 'double_next') { hero.statuses.splice(i, 1); return true; }
    }
    return false;
  }
  function heroDefense(hero) {
    var d = hero.def.defense; hero.statuses.forEach(function (s) { if (s.type === 'def') d += s.value; }); return d;
  }

  combat.enemiesTurn = function (party, rng) {
    var c = party.combat;
    if (combat.combatStatus(party) !== 'ongoing') return;
    aliveEnemies(c).forEach(function (enemy) {
      enemy.turnCount++;
      // boss summon + wave
      if (enemy.boss && enemy.def.special) {
        if (enemy.turnCount % enemy.def.special.summonEvery === 0) {
          c.enemies.push(makeEnemy({ type: enemy.def.special.summon }));
          c.log.push(enemy.name + ' поднимает нового скелета!');
        }
      }
      // choose a random alive hero as target
      var targets = party.heroes.filter(function (h) { return !h.downed; });
      if (targets.length === 0) return;
      var idx = Math.floor((rng || Math.random)() * targets.length);
      var target = targets[idx === targets.length ? targets.length - 1 : idx];
      var toHit = dice.rollD20(enemy.def.attack.bonus - (enemy.atkPenalty || 0), rng);
      if (toHit.total >= heroDefense(target)) {
        var dmg = dice.roll(enemy.def.attack.damage, rng).total;
        state.damageHero(target, dmg);
        c.log.push(enemy.name + ' бьёт ' + target.def.name + ' на ' + dmg + ' урона.');
      } else {
        c.log.push(target.def.name + ' уклоняется от ' + enemy.name + '.');
      }
    });
    // tick statuses
    party.heroes.forEach(function (h) {
      h.statuses = h.statuses.filter(function (s) { if (s.turns) { s.turns--; return s.turns > 0; } return true; });
    });
    c.round++;
    combat.combatStatus(party);
  };

  combat.heroDefense = heroDefense;

  root.DnD.combat = combat;
  if (typeof module !== 'undefined' && module.exports) module.exports = combat;
})(typeof window !== 'undefined' ? window : global);
