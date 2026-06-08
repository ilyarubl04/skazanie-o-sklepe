# Манифест ассетов — «Сказание о Старом Склепе»

Полный список графических ассетов, добавленных в репозиторий, с источниками и лицензиями.
Этот файл — источник правды для внутриигровых титров (CREDITS.md).

Сокращения лицензий:
- **PD (Public Domain)** — общественное достояние. Атрибуция НЕ требуется (картины старых мастеров до 1900 г.). Через Wikimedia Commons.
- **Unsplash** — Unsplash License. Бесплатно для коммерческого использования, атрибуция НЕ требуется.
- **Pexels** — Pexels License. Бесплатно для коммерческого использования, атрибуция НЕ требуется.

---

## A) Портреты героев — `assets/portraits/`

Связный набор: классическая масляная/живописная школа старых мастеров, все произведения — **общественное достояние** (созданы до 1900 г., автор умер более 100 лет назад). Сохранены и как `.jpg` (полное разрешение), и как `.png` 800px (код игры в `js/heroes.js` грузит `.png`).

| Файл | Герой / класс | Произведение и автор | Источник | Лицензия | Атрибуция |
|------|---------------|----------------------|----------|----------|-----------|
| `brand.jpg` / `brand.png` | Бранд — Воин | Mattia Preti, «Portrait of a Knight in Armour» (XVII в.) | Wikimedia Commons | PD | не требуется |
| `lira.jpg` / `lira.png` | Лира — Маг | John William Waterhouse, «The Magic Circle» (1886) — колдунья | Wikimedia Commons | PD | не требуется |
| `finn.jpg` / `finn.png` | Финн — Плут | Rembrandt van Rijn, «Self-portrait with Beret and Red Cloak» (Karlsruhe) | Wikimedia Commons | PD | не требуется |
| `mira.jpg` / `mira.png` | Сестра Мира — Жрец | Carlo Dolci (копия), «Mater Dolorosa» (Blue Madonna), Fitzwilliam Museum | Wikimedia Commons | PD | не требуется |
| `thea.jpg` / `thea.png` | Тэя — Следопыт | Guillaume Seignac, «Diana the Huntress» — охотница с луком | Wikimedia Commons | PD | не требуется |
| `kael.jpg` / `kael.png` | Каэль — Бард | Caravaggio, «The Lute Player» (Hermitage) — лютнист | Wikimedia Commons | PD | не требуется |

Прямые URL источников (Wikimedia Special:FilePath):
- brand: https://commons.wikimedia.org/wiki/File:Mattia_Preti,_Portrait_of_a_Knight_in_Armour.jpg
- lira: https://commons.wikimedia.org/wiki/File:The_magic_circle,_by_John_William_Waterhouse.jpg
- finn: https://commons.wikimedia.org/wiki/File:Rembrandt_-_Self-portrait_with_Beret_and_Red_Cloak_-_Karlsruhe.jpg
- mira: https://commons.wikimedia.org/wiki/File:Carlo_Dolci_(1616-1686)_(copy_after)_-_Mater_Dolorosa_-_215_-_Fitzwilliam_Museum.jpg
- thea: https://commons.wikimedia.org/wiki/File:Guillaume_Seignac_-_Diana_the_Huntress.jpg
- kael: https://commons.wikimedia.org/wiki/File:The_Lute_Player-Caravaggio_(Hermitage).jpg

> Примечание: OpenGameArt.org (предпочтительный источник по ТЗ) недоступен с этого IP — все запросы возвращают «Access denied» (403). Поэтому выбран связный набор PD-живописи Wikimedia Commons, который точно соответствует grimoire-эстетике и не требует атрибуции.

---

## B) Фоны сцен — `assets/scenes/`

Атмосферные фоны под тёмный/сепия-оверлей. 8 целевых `.jpg` (по ТЗ) + `.png`-копии, которые реально грузит код (`js/adventure.js`: `tavern.png`, `forest.png`, `chapel.png`, `crypt.png`, `dawn.png`).

| Файл | Сцена | Содержание | Источник | Лицензия | Атрибуция |
|------|-------|-----------|----------|----------|-----------|
| `menu.jpg` | Меню / старый том | Череп на старинной книге, тёмный фон | Unsplash (photo-1542691646-b06e145f7a95) | Unsplash | не требуется |
| `tavern.jpg` + `tavern.png` | Таверна | Интерьер старого паба с каменным очагом | Unsplash (photo-1588099631365-aacc6480737b) | Unsplash | не требуется |
| `forest.jpg` + `forest.png` | Тёмный лес | Туманный тёмный лес ночью | Unsplash (photo-1760772481955-dcb947cb2d3f) | Unsplash | не требуется |
| `chapel.jpg` + `chapel.png` | Руины часовни | Готические руины аббатства, стрельчатые арки | Unsplash (photo-1570312601864-af0a405333cf) | Unsplash | не требуется |
| `crypt.jpg` + `crypt.png` | Склеп / катакомбы | Оссуарий — стена из черепов и костей | Unsplash (photo-1583267575629-3f032c53afec) | Unsplash | не требуется |
| `boss.jpg` | Зал босса | Тёмный собор с жутким светом у алтаря | Unsplash (photo-1554230771-ce00c063e695) | Unsplash | не требуется |
| `village.jpg` | Деревня | Средневековая деревня/аббатство на закате | Unsplash (photo-1598300868119-9cd70f060e9a) | Unsplash | не требуется |
| `victory.jpg` + `dawn.png` | Победа / рассвет | Золотой рассвет над холмами и морем | Unsplash (photo-1484766280341-87861644c80d) | Unsplash | не требуется |
| `crypt-entrance.png` | Вход в склеп | Лунный вход в старый склеп: каменная арка с рунами, приоткрытая дверь с холодным светом, ворон, череп, фонарь — в рамке старинного гримуара | AI (gpt-image-2 / Codex) | сгенерировано | не требуется |

Базовый шаблон URL: `https://images.unsplash.com/<photo-id>?w=1600&q=80&fm=jpg&fit=max`

> Все фоны (кроме `crypt-entrance.png`) — Unsplash License: бесплатно для коммерции, атрибуция не требуется. `dawn.png` = та же картинка, что `victory.jpg` (код грузит `dawn.png` для финальной сцены). `crypt.png` в коде используется и для сцены босса.
> `crypt-entrance.png` — сгенерировано нейросетью gpt-image-2 (через подписку Codex), 1024×1024, стиль «живой гримуар». Оригинальный ассет, прав третьих лиц не содержит.

---

## C) Арт врагов — `assets/enemies/`

Старинные PD-гравюры/ксилографии в стиле бестиария — соответствуют grimoire-эстетике. Фон не прозрачный (бумага/паспарту), что вписывается в стиль «старого тома».

| Файл | Враг | Произведение и автор | Источник | Лицензия | Атрибуция |
|------|------|----------------------|----------|----------|-----------|
| `wolf.png` | Волк | Charles Hamilton Smith, «The Gray Wolf» — гравюра (Yale Center for British Art) | Wikimedia Commons | PD | не требуется |
| `skeleton.png` | Скелет | Hans Holbein the Younger, «Danse Macabre» №31 «Der Ritter» (Смерть и рыцарь, 1526) | Wikimedia Commons | PD | не требуется |
| `morven.png` | Некромант Морвен | Ebenezer Sibly, «Edward Kelley… invoking the Spirit of a Deceased Person» (некромантия в гравюре, 1806) | Wikimedia Commons | PD | не требуется |
| `wraith.png` | Призрак-плакальщик | Gustave Doré, «Witch of Endor» (1866) — восстающий из-под земли призрак в саване | Wikimedia Commons | PD | не требуется |
| `cultist.png` | Послушник Пастыря | Gustave Doré, «The Witch» — высокая фигура в капюшоне и рясе | Wikimedia Commons | PD | не требуется |
| `bog_hag.png` | Болотная Ведьма-вестница | Francisco de Goya, «Vuelo de brujas» / «Witches' Flight» (1798) | Wikimedia Commons | PD | не требуется |
| `shepherd.png` | Пастырь Тишины / Безмолвная Мать (финальный босс) | Gustave Doré, «Inferno» Canto XXXIV — Люцифер в ледяной Бездне (1861–1868) | Wikimedia Commons | PD | не требуется |

Прямые URL источников:
- wolf: https://commons.wikimedia.org/wiki/File:Charles_Hamilton_Smith_-_The_Gray_Wolf_-_B1981.25.2251_-_Yale_Center_for_British_Art.jpg
- skeleton: https://commons.wikimedia.org/wiki/File:Holbein_Danse_Macabre_31.jpg
- morven: https://commons.wikimedia.org/wiki/File:Edward_Kelley_%E2%80%93_Totenbeschw%C3%B6rung.jpg
- wraith: https://commons.wikimedia.org/wiki/File:Witch_of_Endor._Dore_1866.jpg
- cultist: https://commons.wikimedia.org/wiki/File:Gustave_Dor%C3%A9_-_The_Witch.jpg
- bog_hag: https://commons.wikimedia.org/wiki/File:Francisco_de_Goya_-_Vuelo_de_brujas_(1798).jpg
- shepherd: https://commons.wikimedia.org/wiki/File:Gustave_Dore_Inferno34.jpg

---

## Сводка по атрибуции

**Ни один ассет не требует обязательной атрибуции.**
- Портреты и враги — Public Domain (Wikimedia Commons), картины/гравюры старых мастеров.
- Фоны сцен — Unsplash License (атрибуция не обязательна, но указание авторов — хороший тон).
- `crypt-entrance.png` — оригинальный AI-ассет (gpt-image-2), атрибуция не требуется.

Все CC-BY-ассеты, требующие обязательного указания авторства, в наборе отсутствуют.
