# Publish to Telegram plugin

English | [Русский](https://github.com/pan4ratte/obsidian-publish-to-telegram/blob/main/README_RU.md)

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

6. Show formating instructions either from plugin's settings or from command palette.


## Installation Instructions

Before plugin appears in the official Obsidian store, the easiest way to install it is through the `BRAT` plugin:

1. Install the `BRAT` plugin from the official Obsidian plugin store.

2. In the `BRAT` settings, find the “Beta plugin list” section and click on the “Add beta plugin” button.

3. In the window that appears, paste the link to the `Publish to Telegram` plugin repository: [https://github.com/pan4ratte/obsidian-publish-to-telegram](https://github.com/pan4ratte/obsidian-publish-to-telegram)

4. Under “Select a version” choose “Latest version” and click the “Add plugin” button.

Done! The plugin will automatically install and will be ready to use.


## Usage

### Formatting

All standard Telegram formatting elements are supported:

<table>
  <thead>
    <tr>
      <th>Obsidian Input</th>
      <th>Telegram Result</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>**Bold**</code></td>
      <td><strong>Bold</strong></td>
    </tr>
    <tr>
      <td><code>*Italic*</code></td>
      <td><em>Italic</em></td>
    </tr>
    <tr>
      <td><code>&lt;u&gt;Underline&lt;/u&gt;</code></td>
      <td><u>Underline</u></td>
    </tr>
    <tr>
      <td><code>~~Strikethrough~~</code></td>
      <td><s>Strikethrough</s></td>
    </tr>
    <tr>
      <td><code>&lt;span class="tg-spoiler"&gt;Spoiler&lt;/span&gt;</code></td>
      <td>Spoiler</td>
    </tr>
    <tr>
      <td><code>`Inline code`</code></td>
      <td><code>Inline code</code></td>
    </tr>
    <tr>
      <td><code>[Link](url)</code></td>
      <td><a href="https://obsidian.md">Link</a></td>
    </tr>
    <tr>
      <td><code>&gt; Quote</code></td>
      <td><blockquote>Quote</blockquote></td>
    </tr>
    <tr>
      <td><code>```Code block```</code></td>
      <td><pre><code>Code block</code></pre></td>
    </tr>
    <tr>
      <td><code>- List</code></td>
      <td><ul><li>List</li></ul></td>
    </tr>
    <tr>
      <td><code># Heading</code></td>
      <td><h4>Heading</h4></td>
    </tr>
  </tbody>
</table>

### Attachments

Media, album (groups of media) and document attachments are supported. Note that every attached file must be inside the same folder as current note. To attach a file to your post, use standard Obsidian embed function:

`![[some-book-file.pdf]]`

`![[some-media-file.jpg]]`

Currently supported formats:

| Extension                                          | Attachment type |
| -------------------------------------------------- | --------------- |
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` 			 | Photo / Album   |
| `.pdf`                                             | Document        |

### Limits

Standard Telegram posting limits apply to limits of characters per post, limits of attached media size per post, etc. More about that: [https://limits.tginfo.me/](https://limits.tginfo.me/)

### Advanced publishing settings

You can call an advanced publishing settings window with command palette (`Ctrl + P`) by typing "Publish to Telegram: Publish with advanced settings". In that settings window you can choose to:

* Post to multiple channels/groups at once.
* Post without sound.
* Post with attached media under the text.

## About the Author

My name is Mark Ingram (Ingrem), I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach the subject "Information Technologies in Scientific Research", a unique course that I developed myself from scratch. This plugin helps me in my studies and I use it in my teaching, as well as other plugins that I develop and that you can find on my GitHub profile.

Hello to every student that came across this page!

Huge thanks to [Egor Gvozdikov](https://github.com/egorgvo), who wrote the first lines of code for this project.