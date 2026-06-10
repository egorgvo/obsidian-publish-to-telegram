# Changelog

## 3.1.0

### New features

* **Automatic scheduled posts links fetching.** If "Save posts links" option is enabled in the settings and you make a scheduled post, the plugin will create a task to fetch the link. Fetching happens in two scenarios: when Obsidian is open on scheduled time or if you open Obsidian past scheduled time, the link is automatically fetched and inserted to the corresponding property.
* **Edit pre-written comments after their publication.** Comments links are now stored in the separate `tg_comments` property and after publication you can edit them with the advanced publishing settings. Note that `telegram_links` property was renamed to `tg_posts`: if you used "Save posts links" feature, be sure to rename already existing property with Obsidian core plugin [Properties view](https://obsidian.md/help/plugins/properties).
* **View changelog.** Available to view in the settings, in the user guide, or via the palette command. The notification in the settings could be closed and will not appear until the next update.

### UI/UX enhancements and bug fixes

* New notifications that reflect post/comment editing process.
* Legacy auto-default preset feature removed. Now, if you have only one preset and try to post with the default preset and it is not set up, advanced publishing settings modal will open.
* GramJS `localStorage` API schema cache was disabled to avoid triggering linter issues.
* Fixed UI bugs in the advanced settings.
* Various markdown parsing fixes.


## 3.0.1

* **Hotfix.** Security and stability updates.


## 3.0.0

### Major update

Version 3.0.0 of the plugin presents the biggest update since the beginning of development. The main change is migration from Bot API to User API with many enhancements. Now you can:

* **Authorize into your Telegram account.** No bot creation or any complex setup processes anymore!
* **Post, using Telegram Premium features.** If you have Telegram Premium, for example, you can send media attachments with text up to 4096 symbols (instead of 1024 with bots).
* **Schedule posts.** To do that, just open advanced publishing settings, pick a date and send the post.
* **Search chats in presets.** Presets were completely reimagined and now you can use search field to find target chats: your chat history will automatically load. The option to enter chat its `@username` or `ID` manually us still preserved.
* **Add multiple targets to one preset** Now every preset can hold multiple channels, groups, *forum topics*, chats and bots as publishing targets.

### UI/UX enhancements and bug fixes

* Plugin UI was generally cleaned up and restructured.
* New notifications that reflect posting process.
* Default preset feature updated: if no preset is set as the default, the Advanced publishing settings menu will open.
* Advanced publishing settings option was added to the context menu.
* New error notification when an attempt to publish is made, but the user is not logged in.
* New error notification when an attempt to update the post is made, but no text was changed.
* READMEs and user guide are updated to reflect all changes and new features.
* Startup time was optimized.
* Locales are updated, corrected and cleaned up.
* Fixed a bug when video attachments were sent as GIFs.
* Fixed a bug when pre-written comments were not sent.
* Fixed a bug when "Media attachments below the text" feature didn't work.

Thanks to @egorgvo for his valuable backend contributions.
Thanks to @aevxofficial for the idea to add posting to forum topics feature.
