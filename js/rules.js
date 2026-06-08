(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var dice = root.DnD.dice;
  var rules = {};

  rules.DIFFICULTY = { easy: 8, medium: 11, hard: 14, veryHard: 17 };

  // hero stats stored as dots 1..5 — flat ladder so every dot matters equally (~+5%/dot on d20)
  var BONUS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
  rules.statBonus = function (dots) { return BONUS[dots] || 0; };

  // opts: { statValue (dots), difficulty, extra }
  rules.resolveCheck = function (opts, rng) {
    var bonus = rules.statBonus(opts.statValue) + (opts.extra || 0);
    var r = dice.rollD20(bonus, rng);
    var success = r.total >= opts.difficulty;
    var critFail = r.natural === 1;
    // near-miss: failed but within 2 below the difficulty, and not a natural 1
    var partial = !success && !critFail && r.total >= opts.difficulty - 2;
    return {
      d20: r.rolls[0],
      bonus: bonus,
      total: r.total,
      difficulty: opts.difficulty,
      success: success,
      partial: partial,
      crit: r.natural === 20,
      critFail: critFail
    };
  };

  root.DnD.rules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
})(typeof window !== 'undefined' ? window : global);
