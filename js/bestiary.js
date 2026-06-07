(function (root) {
  'use strict';
  root.DnD = root.DnD || {};

  var ENEMIES = {
    wolf: {
      id: 'wolf', name: 'Волк', art: 'assets/enemies/wolf.png',
      maxHp: 10, defense: 12, attack: { bonus: 3, damage: 'd4+1' },
      pack: true, desc: 'В стае нападают вместе.'
    },
    skeleton: {
      id: 'skeleton', name: 'Скелет', art: 'assets/enemies/skeleton.png',
      maxHp: 12, defense: 11, attack: { bonus: 3, damage: 'd6' },
      undead: true, desc: 'Слаб к Изгнанию нежити и Свету.'
    },
    morven: {
      id: 'morven', name: 'Некромант Морвен', art: 'assets/enemies/morven.png',
      maxHp: 60, defense: 14, attack: { bonus: 5, damage: 'd8+3' },
      boss: true, undead: true,
      special: { summon: 'skeleton', summonEvery: 2, wave: 'd8' },
      desc: 'Призывает скелетов и бьёт тёмной волной по обоим. Светоч и Изгнание ослабляют его.'
    }
  };

  root.DnD.ENEMIES = ENEMIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENEMIES;
})(typeof window !== 'undefined' ? window : global);
