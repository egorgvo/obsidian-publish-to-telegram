export default {
    MENU_TITLE: "Опубликовать в Telegram",
    NOTICE_SUCCESS: "Успешно опубликовано ✅",
    NOTICE_ERR_CONFIG: "Ошибка: Настройте хотя бы один пресет.",
    NOTICE_ERR_SEND: "Ошибка отправки: ",
    NOTICE_ERR_NO_DEFAULT: "Ошибка: Пресет по умолчанию не установлен.",
    SETTING_HEADER: "Настройки Publish to Telegram",
    SETTING_DESCRIPTION: "Плагин позволяет опубликовать активную заметку в Telegram с помощью сочетаний клавиш, палитры команд и контекстных меню. Поддерживается стандартное форматирование текста Telegram, а также загрузка фото, альбомов и документов. Доступны расширенные настройки публикации: пост сразу в несколько каналов/групп, пост без звука и перемещение медиа под текст поста.",
    SETTING_ADD_CHANNEL_NAME: "Инструкция по настройке",
    SETTING_ADD_CHANNEL_DESC: `Плагин работает через ваш личный бот, отправляя ему содержание активной заметки и информацию о канале/группе для публикации. В целях безопасности не передавайте управление вашим ботом третьим лицам.

1. Cоздайте бота с помощью @BotFather и вставьте его токен в соответствующее поле.
2. Узнайте ID вашего канала/группы у @userinfobot и вставьте его в соответствующее поле.
3. Добавьте вашего бота в канал/группу и выдайте ему права на отправку сообщениий.`,
    SETTING_ADD_CHANNEL: "Создать новый пресет публикации",
    SETTING_FORMATTING_HELP: "Справка по форматированию",
    SETTING_OPEN_BOTFATHER: "Открыть @BotFather",
    SETTING_OPEN_USERINFOBOT: "Открыть @userinfobot",
    SETTING_BOT_TOKEN_NAME: "Токен вашего бота",
    SETTING_BOT_TOKEN_DESC: "Получите его у @BotFather",
    SETTING_CHAT_ID_NAME: "ID целевого канала/группы",
    SETTING_CHAT_ID_DESC: "Получите его у @userinfobot",
    SETTING_DELETE_CHANNEL: "Удалить пресет",
    SETTING_DEFAULT_CHANNEL: "Установить как пресет по умолчанию",
    SETTING_DEFAULT_DESC: "Вы можете публиковать с пресетом по умолчанию с помощью сочетания клавиш.",
    SETTING_PLACE_HOLDER_NAME: "Введите название пресета...",
    SETTING_PLACEHOLDER_TOKEN: "Введите токен...",
    SETTING_PLACEHOLDER_CHAT: "Введите ID...",
    CHANNEL_DEFAULT_NAME: "Канал",
    UNTITLED_CHANNEL: "Без названия",
    TOOLTIP_EDIT: "Изменить название",
    CONFIRM_DELETE_TITLE: "Удалить пресет?",
    CONFIRM_DELETE_MSG: "Вы уверены, что хотите удалить пресет \"{name}\"? Это действие нельзя отменить.",
    CONFIRM_DELETE_BTN: "Да, удалить",
    CONFIRM_CANCEL_BTN: "Отмена",
    COMMAND_SEND_DEFAULT: "Опубликовать с помощью пресета по умолчанию",
    COMMAND_SEND_MULTIPLE: "Опубликовать с расширенными настройками",
    COMMAND_SEND_TO_PRESET: "Опубликовать в",
    COMMAND_SHOW_FORMATTING_HELP: "Открыть справку по форматированию",
    MULTI_PRESET_TITLE: "Расширенные настройки публикации",
    MULTI_PRESET_CHANNEL_SELECTION: "Выберите каналы/группы для публикации",
    MULTI_PRESET_ADVANCED_FORMATTING: "Расширенное форматирование",
    MULTI_PRESET_POST_BTN: "Опубликовать",
    MULTI_PRESET_NO_SELECTION: "Выберите хотя бы один пресет",
    MULTI_PRESET_SILENT_POST_NAME: "Опубликовать без звука",
    MULTI_PRESET_SILENT_POST_DESC: "Подписчики получат уведомление без звука",
    MULTI_PRESET_ATTACHMENTS_NAME: "Вложения под текстом",
    MULTI_PRESET_ATTACHMENTS_DESC: "Отображать текст сообщения над прикреплёнными медиафайлами",

    // ─── Formatting Help Modal content ────────────────────────────────────────
    // Edit the markdown below to update what is shown in the formatting help
    // modal. Full Obsidian-flavoured Markdown is supported, including tables.
    FORMATTING_HELP_CONTENT: `
### Formatting elements

All standard Telegram formatting options are supported:

| Formatting element          | Input in Obsidian                       | Telegram Output    |
| --------------------------- | --------------------------------------- | ------------------ |
| **Bold**                    | \`**text**\`                            | \`*text*\`         |
| _Italic_                    | \`*text*\`                              | \`_text_\`         |
| **Underline**               | \`<u>text</u>\`                         | \`__text__\`       |
| ~~Strikethrough~~           | \`~~text~~\`                            | \`~text~\`         |
| Spoiler                     | \`<span class="tg-spoiler">text</span>\`| \`||text||\`       |
| \`Inline Code\`             | \`\` \`code\` \`\`                      | \`\` \`code\` \`\` |
| [Links](https://obsdian.md) | \`[text](url)\`                         | \`[text](url)\`    |
| Block Quotes                | \`> quote\`                             | \`> quote\`        |
| Code Blocks                 | \`\`\`lang\\ncode\`\`\`                 | code block         |
| Lists                       | \`- item\`                              | \`• item\`         |
| Headings                    | \`# Title\`                             | \`*Title*\`        |

### Attachments

Media, album (groups of media) and document attachments are supported. Note that every attached file must be inside the same folder as current note. To attach a file to your post, use standard Obsidian embed function:

\`![[some-book-file.pdf]]\`

\`![[some-media-file.jpg]]\`

Currently supported formats:

| Extension                                          | Attachment type |
| -------------------------------------------------- | --------------- |
| \`.jpg\`, \`.jpeg\`, \`.png\`, \`.gif\`, \`.webp\` | Photo / Album   |
| \`.pdf\`                                           | Document        |

### Limits

Standard Telegram posting limits apply to limits of characters per post, limits of attached media size per post, etc. More about that: [https://limits.tginfo.me/](https://limits.tginfo.me/)

### Advanced publishing settings

You can call an advanced publishing settings window with command palette (\`Ctrl + P\`) by typing "Publish to Telegram: Publish with advanced settings". In that settings window you can choose to:

* Post to multiple channels/groups at once.
* Post without sound.
* Post with attached media under the text.
`,
};