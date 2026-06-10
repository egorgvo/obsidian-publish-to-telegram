# Changelog


## 3.1.0

### What's new

* New feature: Edit pre-written comments after their publication with the advanced publishing settings menu. Comments links are now stored in the `tg_comments` property. Note: `telegram_links` property was renamed to `tg_posts`. If you used feature of saving posts links to properties, be sure to change the name of already existing property with Obsidian core plugin [Properties view](https://obsidian.md/help/plugins/properties).
* New feature: View changelog in the settings, in the user guide, or via the palette command.

### UI/UX enhancements

* New notifications that reflect post/comment editing process.
* Legacy auto-default preset feature removed: Now, if you have only one preset and try to post with default preset and it is not set up, advanced publishing settings modal will open.

### Other

* GramJS localStorage API schema cache was disabled to avoid triggering Obsidian linter.
* Fixed UI bugs in the advanced settings.
* Various markdown parsing fixes.


## 3.0.1

* This 3.0.1 release is a security and stability hotfix. See changelog for the vesrion 3.0.0 to get more information about the latest major update.


## 3.0.0

### Major update

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

### Other

* Startup time was optimized.
* Locales are updated, corrected and cleaned up.
* Fixed a bug when video attachments were sent as GIFs.
* Fixed a bug when pre-written comments were not sent.
* Fixed a bug when "Media attachments below the text" feature didn't work.

Thanks to @egorgvo for his valuable backend contributions.
Thanks to @aevxofficial for the idea to add posting to forum topics feature.
