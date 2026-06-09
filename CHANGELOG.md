# Changelog

## 3.0.1

* This 3.0.1 release is a security and stability hotfix. See changelog for the vesrion 3.0.0 to get more information about the latest major update.

**Full Changelog**: https://github.com/pan4ratte/obsidian-publish-to-telegram/compare/3.0.0...3.0.1

## 3.0.0

### Major update

[ Текст на русском ниже ]

Version 3.0.0 of the plugin presents the biggest update since the beginning of development. The main change is migration from Bot API to User API with many enhancements. Now you can:

* Authorize into your Telegram account. No bot creation or any complex setup processes anymore!
* Post, using Telegram Premium features, if you have premium subscription. For example, send media attachments with text up to 4096 symbols (instead of 1024 with bots).
* Schedule posts in the advanced publishing settings. Just pick a date and send the post.
* Search and add multiple channels, groups, *forum topics*, chats and bots to one preset. Presets were completely rewritten. You can also add target chat by entering its @username or ID manually.

### UI/UX enhancements

* Plugin UI was generally cleaned up and restructured.
* New notifications that reflect posting process were added.
* Default preset feature updated: if no preset is set as the default, the Advanced publishing settings menu will open.
* Advanced publishing settings option was added to the context menu.
* New error notification when an attempt to publish is made, but the user is not logged in.
* New error notification when an attempt to update the post is made, but no text was changed.
* READMEs and user guide are updated to reflect all changes and new features.

## Other

* Startup time was optimized.
* Locales are updated, corrected and cleaned up.
* Fixed a bug when video attachments were sent as GIFs.
* Fixed a bug when pre-written comments were not sent.
* Fixed a bug when "Media attachments below the text" feature didn't work.

Thanks to @egorgvo for his valuable backend contributions.
Thanks to @aevxofficial for the idea to add posting to forum topics feature.

**Full Changelog**: https://github.com/pan4ratte/obsidian-publish-to-telegram/compare/2.7.1...3.0.0

---

## Глобальное обновление 3.0.0

Версия плагина 3.0.0 представляет собой крупнейшее обновление с начала разработки. Главное изменение заключается в миграции с Bot API на User API со многими улучшениями. Теперь вы можете:

* Авторизоваться в ваш Telegram-аккаунт. Больше никаких ботов и сложных процессов настройки!
* Постить, используя фичи Telegram Premium, если у вас есть премиум-подписка. Например, отправлять медиа-вложения с текстом до 4096 символов (вместо 1024, как было с ботами).
* Отправлять посты в отложенные в меню расширенной публикации. Просто выберите дату и отправьте пост.
* Искать и добавлять несколько каналов, групп, *тем в группах*, чатов и ботов в один пресет. Пресеты были полностью переписаны. Также, мы можете добавить целевой чат, введя его @username или ID вручную.

## UI/UX улучшения

* Интерфейс плагина был приведён в порядок и реструктурирован.
* Добавлены новые уведомления, отражающие процесс постинга.
* Обновлена функция постинга с пресетом по умолчанию: если пресет по умолчанию не установлен, открывается окно Расширенных настроек публикации.
* Опция Расширенных настроек публикации была добавлена в контекстное меню.
* Новое уведомление об ошибке, когда делается попытка публикации без авторизации.
* Новое уведомление об ошибке, когда делается попытка обновить пост, но текст не был изменён.
* README-файлы и руководство пользователя были обновлены, чтобы отразить все изменения и новые функции.

## Другое

* Время запуска плагина было оптимизировано.
* Текст интерфейса и переводы были обновлены, подчищены и исправлены.
* Исправлен баг, когда видео-вложения отправлялись как GIF.
* Исправлен баг, когда заготовленные комментарии не отправлялись.
* Исправлен баг, когда функция "Вложения под текстом" не срабатывала.

Благодарность @egorgvo за его ценные бекенд-коммиты.
Спасибо @aevxofficial за идею добавить фичу постинга в темы групп.

**Полный лог изменений**: https://github.com/pan4ratte/obsidian-publish-to-telegram/compare/2.7.1...3.0.0
