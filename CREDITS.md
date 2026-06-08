# Титры и лицензии

Список ассетов, реально использованных в игре на текущий момент, с лицензиями.

## Шрифты
- **Forum** (заголовки) и **Lora** (основной текст) — SIL Open Font License (OFL). Подключены локально из `assets/fonts/`, работают офлайн.

## Текстуры
- **Paper001** — текстура пергамента для панелей. Источник: [ambientCG](https://ambientcg.com/), лицензия **CC0** (общественное достояние, атрибуция не требуется). Файл: `assets/textures/paper.jpg`.

## Музыка и звуковые эффекты
- **Процедурные** — музыка и SFX генерируются прямо в браузере через Web Audio API (`js/audio.js`). Сторонние аудиофайлы не используются.

## Иконка приложения (PWA)
- Колокол на тёмном фоне — нарисован программно (Python PIL), оригинальная графика для этого проекта. Файлы: `assets/icon-192.png`, `assets/icon-512.png`, `assets/apple-touch-icon.png`.

## Графика (фоны сцен и портреты)
Вся живопись приведена к единому тёплому «свечному» тону скриптом `tools/treat-assets.py`. Оригиналы (до обработки) лежат в `assets/_raw/`.

Источники картин, добавленных при пересборке арта:
- **Меню / превью** — Edwaert Collier, *Vanitas — натюрморт с книгами, рукописями и черепом* (ок. 1663). Художник умер в 1710, картина в **общественном достоянии (Public Domain)**. Через [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Edwaert_Collier_-_Vanitas_-_Still_Life_with_Books_and_Manuscripts_and_a_Skull_-_Google_Art_Project.jpg). Файл: `assets/scenes/menu.jpg`.
- **Финал / победа** — Jacob van Ruisdael, *Пейзаж с руинами замка и деревенской церковью*. Художник умер в 1682, **Public Domain**. Через [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Jacob_Isaacksz._van_Ruisdael_-_An_Extensive_Landscape_with_a_Ruined_Castle_and_a_Village_Church_-_WGA20493.jpg). Файл: `assets/scenes/victory.jpg`.
- **Таверна** — David Teniers II, *Интерьер трактира с курящими крестьянами* (ок. 1645). Художник умер в 1690, **Public Domain**. Через [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:David_Teniers_(II)_-_Interieur_van_een_herbeg_met_rokende_boeren_(ca._1645).jpg). Файл: `assets/scenes/tavern.jpg`.
- **Волк** — Johann Elias Ridinger, офорт *Волк в горном пейзаже*. Воспроизведение из Wellcome Collection, лицензия **CC BY 4.0** (требуется указание авторства — выполнено здесь). Через [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A_wolf_in_a_mountainous_landscape._Etching_by_J._E._Ridinger_Wellcome_V0021057ER.jpg). Файл: `assets/enemies/wolf.png`.

Остальные фоны (склеп, часовня, лес, деревня, босс) и враги (скелет, Морвен) — гравюры и фотографии в общественном достоянии / по свободной лицензии, приведённые к общему тону. Портреты героев — живописные работы старых мастеров.

---

Игра сделана с любовью. 2026.
