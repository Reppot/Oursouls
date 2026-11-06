# Our Souls на Render

Витрина, 60 опубликованных товаров, 67 фотографий, страницы печати и бренда, корзина с заявкой в Telegram и конструктор с десятью принтами. Исходные фото лежат в static/catalog. Новые товары и правки сохраняются в Supabase Postgres, новые фото в Supabase Storage.

## Локальная проверка

1. Установи зависимости командой `python -m pip install -r requirements.txt`.
2. Запусти `python check_shop.py` для проверки витрины, корзины, входа, создания товара, фото, скидки и скрытия карточки.
3. Запусти `python app.py`. Витрина открывается на http://127.0.0.1:8780/. Локальный каталог использует SQLite.
4. Для входа на /admin/ до запуска задай ADMIN_PASSWORD_HASH. В PowerShell можно получить хеш командой ниже. Пароль вводится скрыто.

    $env:ADMIN_PASSWORD_HASH = python -c "from getpass import getpass; from werkzeug.security import generate_password_hash; print(generate_password_hash(getpass('Password: ')))"

Имя администратора по умолчанию owner, его можно задать через ADMIN_USER.

## Публикация

1. Создай проект Supabase Free и запусти supabase.sql в SQL Editor. Бакет osp-catalog предназначен для публичных фото товаров. Запись в таблицу и загрузки идут с сервера.
2. Подключи репозиторий с содержимым этой папки к Render через New → Blueprint. Готовый render.yaml задаёт бесплатный веб-сервис, команду запуска, проверку состояния и генерирует секрет сессии.
3. В настройках Render задай SUPABASE_URL, SUPABASE_SECRET_KEY и ADMIN_PASSWORD_HASH. Для Supabase используй серверный ключ sb_secret_... Хеш пароля можно получить локальной командой из предыдущего раздела. Значения этих переменных должны храниться в настройках Render.
4. На полученном адресе onrender.com проверь главную, каталог, /constructor/ и /admin/. Добавь карточку, загрузи фото и после перезапуска убедись, что изменения сохранились. Проверь открытие из российской сети перед переключением адреса сайта.
5. catalog.json содержит импортированные товары. Правки из админки перекрывают исходные записи по ID.

Товары взяты из публичного WooCommerce API. Для закрытых карточек понадобится отдельный экспорт из админки. Корзина привязана к адресу сайта, для новой админки создаётся отдельный вход. Цены оставлены пустыми у товаров, для которых WooCommerce не отдаёт опубликованную цену.

Render Free может запускаться около минуты после простоя. Supabase Free при низкой активности может поставить проект на паузу. [Render Free](https://render.com/docs/free) · [Пауза Supabase Free](https://supabase.com/docs/guides/platform/free-project-pausing)

## Иллюстрации для баннеров

Две иллюстрации созданы встроенным imagegen по композиции экранов Figma.

- static/theme/services-open-book.png: Use case ads-marketing. Landscape web banner for a gothic print shop, wide crop 3:1 centered. Top-down antique open sketchbook with rough cream vellum, large botanical pressed burgundy roses with dark green stems on both pages, on black walnut table, an antique small candlestick at far right. Low-key brown-black cinematic lighting, earthy colors, centered open book across the horizontal canvas, quiet lower contrast middle for cream web heading to be overlaid. Photorealistic still life. Image only, absolutely no letters, words, watermark, logos, text, borders or UI.
- static/theme/home-print-engraving.png: Use case illustration-story. Landscape banner 3:1 for dark streetwear. One giant finely detailed engraved human skull in the right half, diagonal composition, charcoal etched bone on black, dark thorn tendrils and faint graphite rose engraving. Keep far left nearly black and make right half etched mid-dark gray, quiet middle for overlay. Vintage woodcut with dense shading; no bright whites or gore. Image only, no lettering, logo, border, text or UI.
