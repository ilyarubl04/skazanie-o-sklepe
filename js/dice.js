(function (root) {
  'use strict';
  root.DnD = root.DnD || {};

  var dice = {};

  // placeholder, real impl in Task 2
  dice.__loaded = true;

  root.DnD.dice = dice;
  if (typeof module !== 'undefined' && module.exports) module.exports = dice;
})(typeof window !== 'undefined' ? window : global);
