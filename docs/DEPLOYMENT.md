# Публикация Slay And Spire в Telegram

- GitHub: https://github.com/DoctorStrangeSH/slay-the-spire-tg
- Веб-версия: https://doctorstrangesh.github.io/slay-the-spire-tg/
- Telegram Mini App: https://t.me/card_roguelike_bot/Roguelike
- Хостинг веб-клиента: GitHub Pages (в репозитории включён Pages).

## Обновление
1. Внести изменения в отдельную ветку, выполнить тесты и слить PR после успешного CI.
2. Для **каждого изменения файлов JS/CSS**, которое должно попасть пользователям, повысить версию в `index.html`:
   - `<meta name="app-version" content="ГГГГ.ММ.ДД.Н">`
   - все `?v=...` для относительных JS/CSS должны совпадать.
3. CI автоматически проверяет согласованность метки сборки и query-параметров ресурсов.
4. Проверить, что сайт GitHub Pages отдаёт новую версию, затем перезапустить Mini App в Telegram.
5. Проверить версию в главном меню. Если старая — закрыть Mini App полностью и открыть заново.

## Важные ограничения
- Наличие `has_pages=true` подтверждено, однако сам источник сборки Pages
  (ветка/Actions) этим фактом не определяется. Проверить в GitHub
  Settings → Pages → Build and deployment.
- Хостинг статической страницы не означает наличие постоянно запущенного Telegram bot backend.
  Текущему приложению для открытия веб-интерфейса постоянный сервер не нужен.
- `?v=...` обновляет кеш ресурсов, **но не гарантирует** обновление кешированного
  самого `index.html` в Telegram WebView. Если версия долго не меняется,
  перепроверить Pages, а затем перезапустить Mini App.
- Не добавлять токен Telegram-бота в публичный HTML/JavaScript.
- Checkpoint забега хранится в localStorage устройства/WebView; на другом
  устройстве он автоматически не появится.

## Проверки
```bash
node --test tests/*.test.cjs
```
