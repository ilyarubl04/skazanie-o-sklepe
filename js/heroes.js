(function (root) {
  'use strict';
  root.DnD = root.DnD || {};

  var HEROES = [
    {
      id: 'brand', name: 'Бранд', role: 'Воин', portrait: 'assets/portraits/brand.png',
      story: 'Ветеран, оставивший армию ради искупления. Стоит как стена между бедой и слабым.',
      stats: { str: 5, dex: 2, int: 1, cha: 2 }, maxHp: 34, defense: 14,
      attack: { name: 'Удар меча', bonus: 5, damage: 'd8+3', stat: 'str' },
      abilities: [
        { id: 'power_strike', name: 'Мощный удар', icon: 'broadsword', desc: 'Следующая атака наносит двойной урон.', uses: 2, effect: 'double_next' },
        { id: 'guard', name: 'Защита союзника', icon: 'shield', desc: 'Приму на себя следующую атаку по союзнику.', uses: 2, effect: 'guard_ally' },
        { id: 'battle_cry', name: 'Боевой клич', icon: 'screaming', desc: '+2 к атакам обоих героев на 2 хода.', uses: 1, effect: 'buff_attack_party' }
      ]
    },
    {
      id: 'lira', name: 'Лира', role: 'Маг', portrait: 'assets/portraits/lira.png',
      story: 'Сбежала из закрытой академии с запретной книгой. Огонь слушается её слов.',
      stats: { str: 1, dex: 2, int: 5, cha: 3 }, maxHp: 20, defense: 11,
      attack: { name: 'Удар посоха', bonus: 5, damage: 'd6+3', stat: 'int' },
      abilities: [
        { id: 'fireball', name: 'Огненный шар', icon: 'fireball', desc: 'd10+4 урона врагу.', uses: 3, effect: 'damage', damage: 'd10+4' },
        { id: 'arcane_shield', name: 'Магический щит', icon: 'magic-shield', desc: '+4 к защите себе или союзнику на 2 хода.', uses: 2, effect: 'buff_defense' },
        { id: 'light', name: 'Свет', icon: 'light-bulb', desc: 'Освещает тьму, помогает в загадках.', uses: 'unlimited', effect: 'utility' }
      ]
    },
    {
      id: 'finn', name: 'Финн', role: 'Плут', portrait: 'assets/portraits/finn.png',
      story: 'Вор с золотым сердцем и долгом перед гильдией. Замок для него — приглашение.',
      stats: { str: 2, dex: 5, int: 3, cha: 3 }, maxHp: 24, defense: 13,
      attack: { name: 'Удар кинжалов', bonus: 6, damage: 'd6+4', stat: 'dex' },
      abilities: [
        { id: 'sneak_attack', name: 'Удар из тени', icon: 'backstab', desc: '+d8 урона, если враг отвлечён.', uses: 2, effect: 'damage_bonus', damage: 'd8' },
        { id: 'lockpick', name: 'Взлом', icon: 'lockpick', desc: 'Открывает замки и обезвреживает ловушки.', uses: 'unlimited', effect: 'utility' },
        { id: 'pickpocket', name: 'Карманник', icon: 'snatch', desc: 'Шанс добыть предмет или золото.', uses: 'unlimited', effect: 'utility' }
      ]
    },
    {
      id: 'mira', name: 'Сестра Мира', role: 'Жрец', portrait: 'assets/portraits/mira.png',
      story: 'Жрица света, пришедшая на зов о пропавших. Нежить страшится её молитв.',
      stats: { str: 2, dex: 2, int: 4, cha: 4 }, maxHp: 28, defense: 13,
      attack: { name: 'Удар булавы', bonus: 4, damage: 'd6+2', stat: 'str' },
      abilities: [
        { id: 'heal', name: 'Исцеление', icon: 'health-potion', desc: 'Восстанавливает d8+4 HP союзнику.', uses: 3, effect: 'heal', amount: 'd8+4' },
        { id: 'bless', name: 'Благословение', icon: 'holy-symbol', desc: '+2 к броскам союзника на 3 хода.', uses: 2, effect: 'buff_rolls' },
        { id: 'turn_undead', name: 'Изгнание нежити', icon: 'sun', desc: 'Скелеты бегут или получают урон.', uses: 2, effect: 'turn_undead' }
      ]
    },
    {
      id: 'thea', name: 'Тэя', role: 'Следопыт', portrait: 'assets/portraits/thea.png',
      story: 'Одиночка с границы леса. Знает тропы, которых нет на картах.',
      stats: { str: 3, dex: 4, int: 3, cha: 2 }, maxHp: 26, defense: 13,
      attack: { name: 'Выстрел из лука', bonus: 6, damage: 'd8+3', stat: 'dex', ranged: true },
      abilities: [
        { id: 'precise_shot', name: 'Меткий выстрел', icon: 'high-shot', desc: 'Гарантированное попадание +d6 урона.', uses: 2, effect: 'guaranteed_hit', damage: 'd6' },
        { id: 'tracking', name: 'Следопытство', icon: 'footprint', desc: 'Находит следы и скрытые проходы.', uses: 'unlimited', effect: 'utility' },
        { id: 'animal_call', name: 'Зов зверя', icon: 'wolf-head', desc: 'Призывает зверя-помощника на 2 хода.', uses: 1, effect: 'summon_ally' }
      ]
    },
    {
      id: 'kael', name: 'Каэль', role: 'Бард', portrait: 'assets/portraits/kael.png',
      story: 'Странствующий менестрель, что собирает истории и бежит от собственной.',
      stats: { str: 2, dex: 3, int: 3, cha: 5 }, maxHp: 24, defense: 12,
      attack: { name: 'Удар рапиры', bonus: 4, damage: 'd6+2', stat: 'dex' },
      abilities: [
        { id: 'inspire', name: 'Вдохновение', icon: 'musical-notes', desc: 'Переброс или +3 к броску союзника.', uses: 3, effect: 'buff_rolls' },
        { id: 'mockery', name: 'Колкая насмешка', icon: 'sneer', desc: 'Враг: d6 урона и −2 к атаке.', uses: 2, effect: 'debuff_attack', damage: 'd6' },
        { id: 'persuade', name: 'Убеждение', icon: 'conversation', desc: 'Большой бонус к социальным проверкам.', uses: 'unlimited', effect: 'utility' }
      ]
    }
  ];

  root.DnD.HEROES = HEROES;
  if (typeof module !== 'undefined' && module.exports) module.exports = HEROES;
})(typeof window !== 'undefined' ? window : global);
