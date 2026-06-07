(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var dice = {};

  dice.rollDie = function (sides, rng) {
    rng = rng || Math.random;
    return Math.floor(rng() * sides) + 1;
  };

  // notation: "d20", "d8+3", "2d6", "2d6-1"
  dice.roll = function (notation, rng) {
    rng = rng || Math.random;
    var m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(String(notation).replace(/\s/g, ''));
    if (!m) throw new Error('bad dice notation: ' + notation);
    var count = m[1] ? parseInt(m[1], 10) : 1;
    var sides = parseInt(m[2], 10);
    var modifier = m[3] ? parseInt(m[3], 10) : 0;
    var rolls = [];
    var sum = 0;
    for (var i = 0; i < count; i++) { var d = dice.rollDie(sides, rng); rolls.push(d); sum += d; }
    var result = { rolls: rolls, modifier: modifier, total: sum + modifier, sides: sides, count: count };
    if (sides === 20 && count === 1) {
      if (rolls[0] === 20) result.natural = 20;
      else if (rolls[0] === 1) result.natural = 1;
    }
    return result;
  };

  dice.rollD20 = function (bonus, rng) {
    bonus = bonus || 0;
    var r = dice.roll('d20', rng);
    r.modifier = bonus;
    r.total = r.rolls[0] + bonus;
    return r;
  };

  root.DnD.dice = dice;
  if (typeof module !== 'undefined' && module.exports) module.exports = dice;
})(typeof window !== 'undefined' ? window : global);
