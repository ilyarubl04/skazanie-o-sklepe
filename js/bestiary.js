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
    drowned: {
      id: 'drowned', name: 'Гнильный утопленник', art: 'assets/enemies/drowned.png',
      maxHp: 14, defense: 11, attack: { bonus: 3, damage: 'd6' },
      undead: true, desc: 'Разбухший мертвец из стоячей воды. Медлителен, но живуч. Слаб к Свету и Изгнанию нежити.'
    },
    morven: {
      id: 'morven', name: 'Некромант Морвен', art: 'assets/enemies/morven.png',
      maxHp: 60, defense: 14, attack: { bonus: 5, damage: 'd8+3' },
      boss: true, undead: true,
      special: { summon: 'skeleton', summonEvery: 2, wave: 'd8' },
      desc: 'Призывает скелетов и бьёт тёмной волной по обоим. Светоч и Изгнание ослабляют его.'
    },
    bone_golem: {
      id: 'bone_golem', name: 'Костяной голем-страж', art: 'assets/enemies/bone_golem.png',
      maxHp: 45, defense: 14, attack: { bonus: 4, damage: 'd8+2' },
      boss: true, undead: true,
      special: { phaseAt: 0.5, enrage: true },
      desc: 'Огромный страж из костей и камня. Охраняет Светоч на пути силы. Когда здоровье падает ниже половины — впадает в ярость и бьёт сильнее.'
    }
  };

  root.DnD.ENEMIES = ENEMIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENEMIES;
})(typeof window !== 'undefined' ? window : global);
