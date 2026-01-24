# WordPress SEO Settings для SAA Alliance Landing Page

## Готовые тексты для копирования в Yoast SEO

### 1. SEO-заголовок (SEO Title)

**Основной вариант (рекомендуется):**
```
Scientific Analytics Alliance | Enterprise Risk Analytics & AI Platforms
```

**Альтернативные варианты:**
- `Scientific Analytics Alliance | Premium Research & Wealth Intelligence`
- `SAA Alliance | Enterprise-Grade Analytics for Institutional Investors`
- `Scientific Analytics Alliance | NVIDIA AI-Powered Risk Management`

**С переменными Yoast:**
```
%%title%% %%sep%% %%sitename%%
```

**Длина:** 50-60 символов (оптимально для Google)

---

### 2. Мета-описание (Meta Description)

**Основной вариант (рекомендуется, 150 символов):**
```
SAA Alliance: Enterprise risk analytics for institutional investors. NVIDIA AI platforms, climate stress testing. 50+ institutions, 300T+ assets.
```

**Альтернативный вариант (короче, 155 символов):**
```
SAA Alliance: Enterprise analytics platforms for institutional investors. NVIDIA AI-powered risk management, climate stress testing, and real-time intelligence. 7 platforms, 50+ institutions, 300T+ assets under analysis.
```

**Параметры:**
- Длина: 150 символов (максимум для Yoast SEO)
- Включает ключевые слова: enterprise risk analytics, institutional investors, NVIDIA AI, climate stress testing
- Включает социальные доказательства: 50+ institutions, 300T+ assets

---

### 3. Ярлык (Slug/URL)

**Рекомендуемый:**
```
scientific-analytics-alliance
```

**Альтернативы:**
- `saa-alliance`
- `enterprise-risk-analytics`
- `saa-platforms`

---

### 4. Focus Keyphrase (Основное ключевое слово)

**Рекомендуемые варианты (выберите один основной):**

1. **enterprise risk analytics** (рекомендуется)
2. institutional analytics platforms
3. NVIDIA AI risk management
4. climate stress testing platforms

---

### 5. Open Graph настройки (Social Media)

**Title:**
```
Scientific Analytics Alliance | Enterprise Risk Analytics
```

**Description:**
```
Enterprise analytics platforms for institutional investors. NVIDIA AI-powered risk management, climate stress testing, and real-time intelligence. 7 platforms, 50+ institutions, 300T+ assets.
```

**Image:**
- Размер: 1200x630px
- Формат: PNG или JPG
- Содержание: Логотип SAA или скриншот платформы

---

## Пошаговая инструкция для WordPress

### Шаг 1: Откройте страницу в редакторе WordPress
1. Перейдите в **Страницы → Все страницы**
2. Найдите страницу "Saa-alliance - Scientific Analytics Alliance"
3. Нажмите **Редактировать**

### Шаг 2: Заполните SEO-заголовок
1. Прокрутите вниз до блока **Yoast SEO**
2. В поле **"SEO-заголовок"** вставьте:
   ```
   Scientific Analytics Alliance | Enterprise Risk Analytics & AI Platforms
   ```
3. Проверьте что длина в зелёной зоне (50-60 символов)

### Шаг 3: Заполните Мета-описание
1. В поле **"Мета-описание"** вставьте:
   ```
   SAA Alliance: Enterprise risk analytics for institutional investors. NVIDIA AI platforms, climate stress testing. 50+ institutions, 300T+ assets.
   ```
2. Проверьте что длина в зелёной зоне (150 символов)

### Шаг 4: Установите Ярлык
1. В правой панели найдите поле **"Ярлык"** (или в настройках страницы)
2. Введите: `scientific-analytics-alliance`
3. Убедитесь что URL будет читаемым

### Шаг 5: Добавьте Focus Keyphrase
1. В блоке **Yoast SEO** найдите поле **"Focus keyphrase"**
2. Введите: `enterprise risk analytics`
3. Нажмите **"Обновить анализ"**

### Шаг 6: Проверьте SEO-анализ
1. После обновления Yoast покажет рекомендации
2. Исправьте все проблемы (красные/оранжевые индикаторы)
3. Стремитесь к зелёному индикатору

### Шаг 7: Настройте Open Graph (Social Media)
1. В блоке **Yoast SEO** найдите вкладку **"Социальные сети"**
2. Заполните:
   - **Facebook Title:** `Scientific Analytics Alliance | Enterprise Risk Analytics`
   - **Facebook Description:** (то же что Meta Description)
   - **Facebook Image:** Загрузите изображение 1200x630px
3. То же самое для Twitter

### Шаг 8: Сохраните изменения
1. Нажмите **"Обновить"** в правом верхнем углу
2. Проверьте предпросмотр в блоке Yoast SEO
3. Убедитесь что все индикаторы зелёные/оранжевые

---

## Дополнительные рекомендации

### Изображение страницы
- Загрузите изображение для Open Graph (1200x630px)
- Это изображение будет показываться при шаринге в соцсетях

### Canonical URL
- Убедитесь что установлен правильный canonical URL
- Обычно это делается автоматически Yoast SEO

### Robots Meta
- Проверьте что страница **НЕ** закрыта от индексации
- В Yoast SEO → Дополнительно → Robots Meta должно быть: `index, follow`

### Schema Markup
- JSON-LD разметка уже добавлена в HTML файл
- Проверьте что она отображается в исходном коде страницы

---

## Проверка после настройки

1. **Предпросмотр в Yoast:** Проверьте как будет выглядеть страница в поиске Google
2. **Google Search Console:** Отправьте страницу на индексацию
3. **Facebook Debugger:** Проверьте Open Graph теги: https://developers.facebook.com/tools/debug/
4. **Twitter Card Validator:** Проверьте Twitter карточки: https://cards-dev.twitter.com/validator

---

## Ключевые слова для контента

Используйте эти ключевые слова в тексте страницы (но естественно, не переспамьте):

- enterprise risk analytics
- institutional analytics platforms
- NVIDIA AI risk management
- climate stress testing
- portfolio risk management
- financial risk analytics
- enterprise-grade analytics
- institutional investors
- risk management platform
- real-time intelligence

---

## Контакты и дополнительная информация

Если нужна помощь с настройкой, проверьте:
- Документацию Yoast SEO: https://yoast.com/help/
- Google Search Central: https://developers.google.com/search
