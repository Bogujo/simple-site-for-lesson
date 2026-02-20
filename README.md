# это учебный сайт для задачи на паре по "Инструментальным средствам разработки программного обеспечения"

серверная часть реализована на *node.js(express)*

база данных *SQLite*

фронт *HTML, CSS, JavaScript*

## Что умеет сайт
- Создание, чтение, редактирование и удаление заметок (CRUD).
- Закрепление заметок наверху списка.
- Переключение сортировки (сначала новые / сначала старые).
- Светлая и тёмная тема (сохраняется в `localStorage`).
- Инлайн-редактирование заметок прямо в списке.
- Постраничная загрузка заметок через кнопку "Показать ещё".

## Минимальные production-улучшения
- Добавлена серверная валидация текста и ID.
- Обработка ошибок БД с корректными HTTP-статусами.
- Безопасный рендер заметок на фронтенде (без `innerHTML` для пользовательского текста).
- Ограничение размера JSON body (`16kb`).
- Базовые security headers на сервере.
- Базовый rate-limit для `/notes`.
- Время создания заметки хранится в формате ISO.

## установка и запуск

1. клонировать репозиторий в желаемую папку
   ```bash
   git clone https://github.com/Bogujo/simple-site-for-lesson
   ```
2. установить зависимости
   ```bash
   npm install
   ```
3. запустить сервер (CTRL + C чтобы остановить сервер)
   ```bash
   npm start
   ```
4. открыть в браузере
   ```
   http://localhost:3000
   ```

## API
- `GET /health` — health-check.
- `GET /notes?order=asc|desc&limit=20&offset=0` — получить список заметок с пагинацией.
- `POST /notes` — создать заметку, JSON: `{ "text": "..." }`.
- `PUT /notes/:id` — обновить текст заметки.
- `PUT /notes/:id/pin` — переключить закрепление.
- `DELETE /notes/:id` — удалить заметку.

## Как не ловить конфликты каждый раз

Если при `git pull` постоянно появляются конфликты в `README.md`, `public/index.html`, `public/script.js`, `public/style.css`, `server.js`, обычно причина в том, что локальная ветка и удалённая долго развиваются независимо.

Рекомендованный поток:

1. Перед началом работы синхронизироваться с основной веткой:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Делать небольшие коммиты (не один большой на все файлы сразу).
3. Перед пушем снова подтянуть свежую `main` через rebase:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
4. Только потом пушить:
   ```bash
   git push --force-with-lease
   ```

### Быстрое разрешение конфликтов по текущей задаче

Когда конфликт уже случился:

```bash
git status
# открыть каждый конфликтный файл и оставить нужный вариант
# затем:
git add README.md public/index.html public/script.js public/style.css server.js
git rebase --continue
```

Если нужно отменить неудачный rebase:

```bash
git rebase --abort
```

Если хотите "взять всё из вашей ветки" для этих файлов (грубый, но быстрый вариант):

```bash
git checkout --ours README.md public/index.html public/script.js public/style.css server.js
git add README.md public/index.html public/script.js public/style.css server.js
git rebase --continue
```
