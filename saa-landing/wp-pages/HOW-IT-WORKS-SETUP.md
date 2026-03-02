# Настройка анимации «How it works»

Всё в одном плагине: JS уже внутри, копировать файлы вручную не нужно.

---

## Что сделать

1. **Заархивировать папку** `saa-berry-phase-hero` (из репозитория: `saa-landing/wp-pages/saa-berry-phase-hero/`) в zip. Внутри zip должна быть одна папка `saa-berry-phase-hero` с файлами:
   - `saa-berry-phase-hero.php`
   - `berry-phase-hero.js`
   - `platform-hero-canvas.js`

2. **В WordPress:** Плагины → Добавить новый → Загрузить плагин — выбрать zip, установить и **активировать**.

3. **How it works:** в HTML-виджете контент из **how-it-works.html** (canvas без `<script>`).  
   **Platform:** в виджете контент из **platform/index.html** (canvas `id="heroCanvas"`).

Готово. На How it works — Berry Phase; на Platform — circuit-анимация (провода, гейты, частицы).

---

## Если slug страниц другие

В `saa-berry-phase-hero/saa-berry-phase-hero.php`:  
- для How it works замените `'how-it-works'` на slug страницы;  
- для Platform замените `'platform'` на slug страницы Platform.
