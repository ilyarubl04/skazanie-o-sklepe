(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var dice = root.DnD.dice;
  var rules = {};

  rules.DIFFICULTY = { easy: 8, medium: 12, hard: 16, veryHard: 20 };

  // hero stats stored as dots 1..5
  var BONUS = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 6 };
  rules.statBonus = function (dots) { return BONUS[dots] || 0; };

  // opts: { statValue (dots), difficulty, extra }
  rules.resolveCheck = function (opts, rng) {
    var bonus = rules.statBonus(opts.statValue) + (opts.extra || 0);
    var r = dice.rollD20(bonus, rng);
    var success = r.total >= opts.difficulty;
    return {
      d20: r.rolls[0],
      bonus: bonus,
      total: r.total,
      difficulty: opts.difficulty,
      success: success,
      crit: r.natural === 20,
      critFail: r.natural === 1
    };
  };

  root.DnD.rules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
})(typeof window !== 'undefined' ? window : global);
