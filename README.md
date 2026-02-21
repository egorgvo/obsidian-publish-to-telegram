# Publish to Telegram plugin

English | Русский

This plugin allows you to post notes directly to Telegram channels and groups with different presets. The plugin works through your personal bot, sending to it contents of active note and information about the channel/group to post to. Standard Telegram text formatting is supported, as well as photo, album and documents uploads, plus some advanced publishing settings are available.


## Features

1. Create multiple presets to post to different channels.

2. Post in different ways: with hotkeys, command palette and context menus.

3. Attach photos, albums and documents to your posts.

4. Use advanced publishing settings to:

	* Post to multiple channels/groups at once.
	* Post without sound.
	* Post with attached media under the text.

5. Set a default preset to post quickly with it from command palette or with hotkey.


## Installation Instructions

Before plugin appears in the official Obsidian store, the easiest way to install it is through the `BRAT` plugin:

1. Install the `BRAT` plugin from the official Obsidian plugin store.

2. In the `BRAT` settings, find the “Beta plugin list” section and click on the “Add beta plugin” button.

3. In the window that appears, paste the link to the `Publish to Telegram` plugin repository: [https://github.com/pan4ratte/obsidian-publish-to-telegram](https://github.com/pan4ratte/obsidian-publish-to-telegram)

4. Under “Select a version” choose “Latest version” and click the “Add plugin” button.

Done! The plugin will automatically install and will be ready to use.


## Usage

### Formatting

Standard Telegram formatting supported, so if you use Obsidian markdown syntax, it will automatically convert to Telegram syntax. Formatting examples, that were successfully tested:

1. `Regular text` becomes Regular text 

2. `**Bold text**` becomes **Bold text** 

3. `*Italics*` becomes *Italics*

4. `~~Strikethrough~~` becomes ~~Strikethrough~~

5. `<u>Underline</u>` becomes <ins>Underline</ins>

6. `> Quote` becomes

	> Quote

7. ``Code block`` becomes `Code block`

8. `[A link](https://obsidian.md)` becomes [A link](https://obsidian.md)

9. `#tag` becomes #tag

10. `@mention` becomes @mention

### Attachments

Media, albums (multiple media) and document attachments are supported. To post with media attached, just use standard Obsidian embed function:

`![[some-book-file.pdf]]`

`![[some-media-file.jpg]]`

Note that every attached file must be inside the current vault.

### Limits

Standard Telegram posting limits apply both to limits of characters per post and limits of attached media size per post.

### Advanced publishing settings

You can call an advanced publishing settings window with command palette (`Ctrl + P`) by typing "Publish to Telegram: Publish with advanced settings". In that dialog window you can choose to:

* Post to multiple channels/groups at once.
* Post without sound.
* Post with attached media under the text.

## About the Author

My name is Mark Ingram (Ingrem), I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach the subject "Information Technologies in Scientific Research", a unique course that I developed myself from scratch. This plugin helps me in my studies and I use it in my teaching, as well as other plugins that I develop and that you can find on my GitHub profile.

Hello to every student that came across this page!

Huge thanks to [Egor Gvozdikov](https://github.com/egorgvo), who wrote the first lines of code for this project.
