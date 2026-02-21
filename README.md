# Publish to Telegram plugin

English | Русский

This plugin allows you to post notes directly to Telegram channels and groups with different presets. The plugin works through your personal bot, sending to it contents of an active note and information about the channel/group to post to. Every standard Telegram formatting options are supported, as well as photo, album and document uploads, plus some advanced publishing settings are available.


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

All standard Telegram formatting options are supported:

| Formatting element          | Input in Obsidian                      | Telegram Output    |
| ----------------------------| -------------------------------------- | -------------------|
| **Bold**                    | `**text**`                             | `*text*`           |
| _Italic_                    | `*text*`                               | `_text_`           |
| **Underline**               | `<u>text</u>`                          | `__text__`         |
| ~~Strikethrough~~           | `~~text~~`                             | `~text~`           |
| Spoiler                     | `<span class="tg-spoiler">text</span>` | `                  |
| `Inline Code`               | `` `code` ``                           | `` `code` ``       |
| [Links](https://obsdian.md) | `[text](url)`                          | `[text](url)`      |
| Block Quotes                | `> quote`                              | > quote 			|
| Code Blocks                 | lang code                              | code               |
| Lists                       | `- item`                               | `• item`           |
| Headings                    | `# Title`                              | `*Title*`          |

### Attachments

Media, album (groups of media) and document attachments are supported. To do that, use standard Obsidian embed function:

\`![[some-book-file.pdf]]\`

\`![[some-media-file.jpg]]\`

Note that every attached file must be inside the same folder as current note. Currently supported formats:

| Extension                                          | Attachment type |
| -------------------------------------------------- | --------------- |
| \`.jpg\`, \`.jpeg\`, \`.png\`, \`.gif\`, \`.webp\` | Photo / Album   |
| \`.pdf\`                                           | Document        |

### Limits

Standard Telegram posting limits apply to limits of characters per post, limits of attached media size per post etc. More about that: [https://limits.tginfo.me/](https://limits.tginfo.me/)

### Advanced publishing settings

You can call an advanced publishing settings window with command palette (`Ctrl + P`) by typing "Publish to Telegram: Publish with advanced settings". In that settings window you can choose to:

* Post to multiple channels/groups at once.
* Post without sound.
* Post with attached media under the text.

## About the Author

My name is Mark Ingram (Ingrem), I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach the subject "Information Technologies in Scientific Research", a unique course that I developed myself from scratch. This plugin helps me in my studies and I use it in my teaching, as well as other plugins that I develop and that you can find on my GitHub profile.

Hello to every student that came across this page!

Huge thanks to [Egor Gvozdikov](https://github.com/egorgvo), who wrote the first lines of code for this project.
