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
    },
    // --- Акт 3 (Гать Сумрачи) ---
    // ПРИМЕЧАНИЕ по движку: combat.js читает special ТОЛЬКО у боссов (var sp = enemy.boss ? ...).
    // У рядового призрака AoE-волна (wave) движком игнорировалась бы, поэтому wraith — это
    // сильный одиночный атакующий (bonus 4 / d6+1, с приличным HP). Полноценную тёмную волну
    // получит босс-Пастырь в Акте 5 (там она реально отработает как special.wave). 'fearStrike'
    // ниже — декоративный тег для лора/будущего UI, движок его не использует, бой не ломает.
    wraith: {
      id: 'wraith', name: 'Призрак-плакальщик', art: 'assets/enemies/wraith.png',
      maxHp: 16, defense: 13, attack: { bonus: 4, damage: 'd6+1' },
      undead: true, fearStrike: true,
      desc: 'Бесплотный плакальщик болот. Воет так, что стынет кровь, и бьёт холодом могилы. Слаб к Свету и Изгнанию нежити.'
    },
    cultist: {
      id: 'cultist', name: 'Послушник Пастыря', art: 'assets/enemies/cultist.png',
      maxHp: 15, defense: 12, attack: { bonus: 4, damage: 'd6+1' },
      undead: false,
      desc: 'Живой фанатик Ордена Безмолвия. Идёт к Сердцу-Колоколу с тихой молитвой на устах. ЖИВОЙ — Изгнание нежити на него не действует.'
    },
    bog_hag: {
      id: 'bog_hag', name: 'Болотная Ведьма-вестница', art: 'assets/enemies/bog_hag.png',
      maxHp: 50, defense: 13, attack: { bonus: 4, damage: 'd8+1' },
      boss: true, undead: false,
      special: { summon: 'drowned', summonEvery: 2 },
      drops: 'tuningFork1',
      desc: 'Вестница Пастыря на гати к монастырю. Поднимает из трясины утопленников и насылает гнильную порчу. Стережёт первый камертон.'
    },
    // --- Акт 4 (Монастырь Безмолвия) ---
    // ПРИМЕЧАНИЕ по движку: combat.js читает special ТОЛЬКО у боссов (var sp = enemy.boss ? ...).
    // Поэтому рядовой voiceless — просто крепкий атакующий: «хоровой» AoE он сам по себе НЕ
    // выдаёт. Общий «немой вопль» по обоим героям реализован у босса-Хора (choir) через
    // special.wave — там он реально отрабатывает.
    voiceless: {
      id: 'voiceless', name: 'Безголосый', art: 'assets/enemies/voiceless.png',
      maxHp: 13, defense: 12, attack: { bonus: 3, damage: 'd6' },
      undead: true,
      desc: 'Послушник Ордена, которому вырвали голос, чтобы он пел лишь песнь Бездны. Бредёт молча, с зашитым ртом. Слаб к Свету и Изгнанию нежити.'
    },
    bell_warden: {
      id: 'bell_warden', name: 'Регент-звонарь', art: 'assets/enemies/bell_warden.png',
      maxHp: 55, defense: 14, attack: { bonus: 5, damage: 'd8+2' },
      boss: true, undead: true,
      special: { phaseAt: 0.5, summon: 'skeleton', summonEvery: 3 },
      drops: 'tuningFork2',
      desc: 'Хранитель колокольни павшего Ордена. Когда здоровье падает ниже половины — бьёт в колокол, и на его зов из праха встают скелеты. Стережёт второй камертон.'
    },
    choir: {
      id: 'choir', name: 'Хор Безголосых', art: 'assets/enemies/choir.png',
      maxHp: 40, defense: 12, attack: { bonus: 4, damage: 'd6+1' },
      boss: true, undead: true,
      special: { wave: 'd6' },
      desc: 'Три связанные одной цепью фигуры в саванах поют как один голос. Их «немой вопль» бьёт по обоим героям сразу. Слаб к Свету и Изгнанию нежити.'
    }
  };

  root.DnD.ENEMIES = ENEMIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENEMIES;
})(typeof window !== 'undefined' ? window : global);
