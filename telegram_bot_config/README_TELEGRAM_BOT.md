# Telegram Bot Integration

Вставляй код Telegram-бота именно в эту папку: `telegram_bot_config/`.

```js
// ВСТАВЬ КОД TELEGRAM-БОТА В ЭТУ ПАПКУ (telegram_bot_config/), ЧТОБЫ НЕ ПРОЕБАТЬСЯ.
```

## Как подключить токен
1. Создай файл `telegram_bot_config/.env`.
2. Добавь туда переменную:

```env
TELEGRAM_BOT_TOKEN=PASTE_YOUR_NEW_TOKEN_HERE
```

3. Создай `telegram_bot_config/bot.js` и читай токен из `process.env.TELEGRAM_BOT_TOKEN`.

> Важно: если токен уже где-то публично отправлялся, лучше сразу перевыпустить его через @BotFather.
