export default {
    MENU_TITLE: "Publish to Telegram",
    NOTICE_PUBLISHING: "Publishing the post…",
    NOTICE_EDITING: "Editing the post…",
    NOTICE_EDITING_COMMENTS: "Editing the comment…",
    NOTICE_PUBLISHING_COMMENTS: "Publishing pre-written comments…",
    NOTICE_SUCCESS: "Successfully published ✅",
    NOTICE_EDITED: "Post edited ✅",
    NOTICE_COMMENTS_EDITED: "Comment edited ✅",
    NOTICE_SCHEDULED: "Post scheduled ✅",
    NOTICE_ERR_CONFIG: "Error: Set up at least one preset.",
    NOTICE_ERR_SEND: "Publishing error: ",
    NOTICE_ERR_TOO_LONG_TEXT: "Error: Post must be less than 4097 symbols.",
    NOTICE_ERR_TOO_LONG_CAPTION: "Error: Post with media attachments must be less than 1025 symbols.",
    NOTICE_ERR_NOT_AUTHENTICATED: "Error: Authorize into your Telegram account in the plugin settings before publishing.",
    NOTICE_ERR_NOT_MODIFIED: "Nothing to update: contents weren't changed.",
    SETTING_HEADER: "Publish to Telegram Settings",
    SECTION_GENERAL: "General",
    SECTION_PRESETS: "Presets",
    SETTING_DESCRIPTION: "This plugin allows you to post notes directly to Telegram channels, groups and personal messages. All Telegram formatting options are supported, as well as media and document attachments. Use advanced publishing settings menu to schedule posts, send them to multiple chats at once and more.",
    SETTING_ADD_CHANNEL_NAME: "Preset creation and usage",
    SETTING_ADD_CHANNEL_DESC: `1. Authorize into your account and make sure that you have relevant permissions to post to the target channels/groups.
2. Create a new preset and click on the search field to load chat list. You can also enter @username or ID manually.
3. Add one or multiple target channels, groups, forum topics, chats or bots to the preset.

* Note that the user guide describes all of the plugin’s features and supported formatting options in detail.
** You can get the ID of any user, channel, group or bot with the @userinfobot.`,
    SETTING_ADD_CHANNEL: "Create new preset",
    SETTING_FORMATTING_HELP: "User guide",
    SETTING_OPEN_USERINFOBOT: "Open @userinfobot",
    SETTING_DEFAULT_CHANNEL: "Set as the default preset",
    SETTING_DEFAULT_DESC: "Publish with the defualt preset from the context menu of with a hotkey",
    SETTING_PLACE_HOLDER_NAME: "Preset name…",
    SETTING_PLACEHOLDER_CHAT: "@username or ID…",
    SETTING_PLACEHOLDER_CHAT_SEARCH: "Search target chats or enter @username or ID manually…",
    SETTING_CHAT_PICKER_LOADING: "Loading chats…",
    CHANNEL_DEFAULT_NAME: "New Preset",

    CONFIRM_DELETE_TITLE: "Delete preset?",
    CONFIRM_DELETE_MSG: "Are you sure you want to delete \"{name}\" preset? This action is irreversible.",
    CONFIRM_DELETE_BTN: "Yes, delete",
    CONFIRM_LOGOUT_TITLE: "Log out?",
    CONFIRM_LOGOUT_MSG: "Are you sure you want to log out of your Telegram account?",
    CONFIRM_LOGOUT_BTN: "Yes, log out",
    CONFIRM_CANCEL_BTN: "Cancel",
    COMMAND_SEND_DEFAULT: "Publish with default preset",
    COMMAND_SEND_MULTIPLE: "Publish with advanced settings",
    COMMAND_SEND_TO_PRESET: "Publish to",
    COMMAND_SHOW_FORMATTING_HELP: "Open user guide",
    COMMAND_SHOW_CHANGELOG: "View changelog",
    MULTI_PRESET_TITLE: "Advanced publishing settings",
    MULTI_PRESET_CHANNEL_SELECTION: "Choose one or multiple presets",
    MULTI_PRESET_ADVANCED_FORMATTING: "Advanced post settings",
    MULTI_PRESET_POST_BTN: "Publish",
    MULTI_PRESET_EDIT_BTN: "Edit",
    MULTI_PRESET_NO_SELECTION: "Choose at least one preset",
    MULTI_PRESET_SILENT_POST_NAME: "Publish silently",
    MULTI_PRESET_SILENT_POST_DESC: "Subscribers will receive a notification without sound",
    MULTI_PRESET_ATTACHMENTS_NAME: "Attachments below the text",
    MULTI_PRESET_ATTACHMENTS_DESC: "Display post text above the attached media files",
    MULTI_PRESET_SCHEDULE_NAME: "Schedule the post",
    MULTI_PRESET_SCHEDULE_DESC: "Leave empty to publish immediately",
    MULTI_PRESET_UPDATE_HEADING: "Editing",
    MULTI_PRESET_UPDATE_NAME: "Edit existing post",
    MULTI_PRESET_UPDATE_NAME_DESC: "Links are stored in the tg_posts property",
    MULTI_PRESET_UPDATE_NO_OPTION: "Choose a link",
    MULTI_PRESET_UPDATE_LINK_LABEL: "{link}",
    MULTI_PRESET_UPDATE_NO_LINKS: "No post links found in properties of the note",
    MULTI_PRESET_UPDATE_RESOLVING: "Loading…",
    MULTI_PRESET_UPDATE_WILL_USE: "Will edit the post in {name}",
    MULTI_PRESET_UPDATE_NO_MATCH: "Could not resolve this link",
    MULTI_PRESET_UPDATE_NO_MATCH_NOTICE: "Could not resolve this link!",
    MULTI_PRESET_EDIT_COMMENTS_NAME: "Edit existing comments",
    MULTI_PRESET_EDIT_COMMENTS_DESC: "Links are stored in the tg_posts property",
    MULTI_PRESET_EDIT_COMMENTS_NO_LINKS: "No comment links found in properties of the note",
    MULTI_PRESET_EDIT_COMMENTS_ALL_CHATS: "Edit in all chats",
    SETTING_SAVE_POST_LINKS_NAME: "Save posts links",
    SETTING_SAVE_POST_LINKS_DESC: "If enabled, the link to the published post will be saved to the note's properties",
    SETTING_MD_EMBEDS_AS_COMMENTS_NAME: "Treat .md embeds as post comments",
    SETTING_MD_EMBEDS_AS_COMMENTS_DESC: "If enabled, the contents of .md-attachments will be sent as comments to the post discussion",

    CHANGELOG_BANNER_PREFIX: "What's new in version ",
    CHANGELOG_BANNER_DISMISS: "Dismiss until next update",
    CHANGELOG_LOAD_ERROR: "Could not load changelog",

    AUTH_AUTHORIZED_AS: "Authorized as: {name}",
    AUTH_LOGOUT_BTN: "Log out",
    AUTH_STEP_1: "Authorization: Step 1 of 2",
    AUTH_STEP_2: "Authorization: Step 2 of 2",
    AUTH_PHONE_NOTE: "*Phone number linked to your Telegram account from which publications will be made.",
    AUTH_CODE_NOTE: "*The code will arrive in Telegram",
    AUTH_QR_TITLE: "Sign in with QR Code",
    AUTH_QR_NOTE: "Open Telegram on your phone → Settings → Devices → Link Desktop Device, then scan the code.",
    AUTH_QR_USE_PHONE: "Use phone number instead",
    AUTH_PHONE_USE_QR: "Use QR code instead",

    AUTH_PHONE_PLACEHOLDER: "+1234567890",
    AUTH_SEND_CODE_BTN: "Send code",
    AUTH_CODE_PLACEHOLDER: "Enter code…",
    AUTH_VERIFY_BTN: "Verify",
    AUTH_PASSWORD_REQUIRED: "Two-factor authentication is enabled. Enter your cloud password.",
    AUTH_PASSWORD_PLACEHOLDER: "Enter password…",
    AUTH_SUCCESS: "Successfully authorized",
    AUTH_ERROR: "Authorization error",
    AUTH_LOADING: "Please wait…",

    FORMATTING_HELP_CONTENT: `
You can open these instructions from the command palette by typing "Publish to Telegram: Open user guide". You can also [view changelog](obsidian://command?id=publish-to-telegram:show-changelog) of the latest updates.

### Presets

To publish notes to Telegram, you need to configure a preset.

1. In the plugin settings, log in to your account and make sure you have the relevant permissions to post to the target channels/groups. Phone number and QR authorizations are available.

2. Create a new preset and click on the search field to load chat list. You can also enter \`@username\` or \`ID\` manually. You can get the \`ID\` of any user, channel, or group with [@userinfobot](https://t.me/userinfobot).

3. Add one or multiple target channels, groups, forum topics, chats or bots to the preset.

Now you can post notes to Telegram using your preset’s name via the command palette, the note’s context menu, or keyboard shortcuts.

### Formatting

All standard Telegram formatting elements are supported as well as some additional:

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
      <td><code><spoiler>Spoiler</spoiler></code></td>
      <td>Spoiler</td>
    </tr>
    <tr>
      <td><code>\`Inline code\`</code></td>
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
      <td><codeblock>\`\`\`<br>Code block<br>\`\`\`</codeblock></td>
      <td><pre><code>Code block</code></pre></td>
    </tr>
    <tr>
      <td><code>- List</code> or <code>* List</code> or <code>+ List</code></td>
      <td><ul><li>List</li></ul></td>
    </tr>
    <tr>
      <td><code>1. List</code> or <code>1) List</code></td>
      <td>1. List or 1) List</td>
    </tr>
    <tr>
      <td><code># Heading</code></td>
      <td><h5>Heading</h5></td>
    </tr>
    <tr>
      <td><code>---</code> or <code>***</code> or <code>___</code></td>
      <td>───</td>
    </tr>
  </tbody>
</table>

#### Omitting text from a post

In addition to the formatting that will be reflected in the Telegram post, you can use the comment syntax \`<!-- hidden text -->\` or \`%% hidden text %%\` to add information to your notes that will not be included in the post content when it is published.

#### Splitting the note into multiple posts

You can also use the special command \`<!-- \\split -->\` or \`%% \\split %%\` to split the text of your note into separate posts. If you use this command, the plugin will publish all posts at the same time. Attachments (see below), including pre-written comments, must appear before the special command that marks the end of the post.

### Attachments

Media, album (groups of media) and document attachments are supported. To attach a file to your post, use any of the standard Obsidian embed syntax options:

\`![[some-book-file.pdf]]\`

\`![](some-media-file.jpg)\`

\`!(some-video-file.mp4)[]\`

You can also embed files with external web-link embeds:

\`![](https://obsidian.md/image.png)\`

Currently supported formats:

| Extension                                          | Attachment type  |
| -------------------------------------------------- | ---------------- |
| \`.jpg\`, \`.jpeg\`, \`.png\`, \`.webp\`           | Photo / Album    |
| \`.gif\`                                           | Animation        |
| \`.mp4\`, \`.mov\`, \`.avi\`, \`.mkv\`, \`.webm\`  | Video / Album    |
| \`.pdf\`                                           | Document         |

### Pre-written comments

You can pre-write one or more comments for your post that will appear in its discussion right after the publication. To use that feature:

1. In the plugin settings turn on the option "Treat .md embeds as post comments".

2. To prepare a comment for a post, use the \`![[comment-file]]\` embed syntax. Only files with the .md extension are treated comments.

A couple of notes:

* If a comment on a post is published in a group or in personal messages, it will appear as a regular reply to a message.

* If you split the note into multiple posts (see above), you can attach the comments to each of the posts. To do that, place .md-embeds before the corresponding marker.

* All comments are published with a slight delay.

* For now, it is not possible to schedule pre-written comments.

### Advanced publishing settings

You can open an advanced publishing settings window with command palette (\`Ctrl + P\`) by typing "Publish to Telegram: Publish with advanced settings". In that settings window you can choose to:

* Post, using multiple presets at once.

* Post without sound.

* Post with attached media under the text.

* Schedule the publication.

* Edit already existing posts or pre-written comments. Links are stored in the \`tg_posts\` and \`tg_comments\` properties, that are filled automatically if the corresponding option is enabled in the settings. You can also create them and fill manually.

### Limits

Standard Telegram posting limits apply to limits of characters per post, limits of attached media size per post, etc. More about that: [https://limits.tginfo.me/](https://limits.tginfo.me/)

I also highly recommend my other plugin, [Advanced Word Count](https://community.obsidian.md/plugins/advanced-word-count), which lets you create detailed presets for word counts in notes and offers significantly greater functionality compared to the standard Obsidian word counter. This plugin can be configured to count characters exactly the same way Telegram does.

---

### About the Author

My name is Mark Ingram (Ingrem), I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach the subject "Information Technologies in Scientific Research", a unique course that I developed myself from scratch. This plugin helps me in my studies and I use it in my teaching, as well as other plugins that I develop and that you can find on [my GitHub profile](https://github.com/pan4ratte/).

Hello to every student that came across this page!

Huge thanks to [Egor Gvozdikov](https://github.com/egorgvo), who wrote the first lines of code for this project and made numerous valuable commits.
`,
};
