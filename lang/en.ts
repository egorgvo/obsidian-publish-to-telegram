export default {
    MENU_TITLE: "Publish to Telegram",
    NOTICE_PUBLISHING: "Publishing the post…",
    NOTICE_PUBLISHING_COMMENTS: "Publishing pre-written comments…",
    NOTICE_SUCCESS: "Successfully published ✅",
    NOTICE_SCHEDULED: "Post scheduled ✅",
    NOTICE_ERR_CONFIG: "Error: Set up at least one preset.",
    NOTICE_ERR_SEND: "Publishing error: ",
    NOTICE_ERR_TOO_LONG_TEXT: "Error: Post must be less than 4097 symbols.",
    NOTICE_ERR_TOO_LONG_CAPTION: "Error: Post with media attachments must be less than 1025 symbols.",
    NOTICE_ERR_NO_DEFAULT: "Error: Default preset is not set up.",
    SETTING_HEADER: "Publish to Telegram Settings",
    SECTION_GENERAL: "General",
    SECTION_PRESETS: "Presets",
    SETTING_DESCRIPTION: "This plugin allows you to post notes directly to Telegram channels and groups. All Telegram formatting options are supported, as well as media and document attachments. Use advanced publishing settings menu to schedule posts, send them to multiple channels/groups at once and more.",
    SETTING_ADD_CHANNEL_NAME: "Preset creation and usage",
    SETTING_ADD_CHANNEL_DESC: `Note that the user guide describes all of the plugin’s features and supported formatting options in detail.

1. Authorize into your account and make sure that you have relevant permissions to post to the target channel/group.
2. Copy channel's @nickname or group/user ID. You can get the ID of any user, channel, or group with the @userinfobot.
3. Create a new preset and paste @nickname or ID into the "Target channel/group" field.`,
    SETTING_ADD_CHANNEL: "Create new preset",
    SETTING_FORMATTING_HELP: "User guide",
    SETTING_OPEN_USERINFOBOT: "Open @userinfobot",
    SETTING_CHAT_ID_NAME: "Target channel/group",
    SETTING_CHAT_ID_DESC: "Enter @username or ID",
    SETTING_DELETE_CHANNEL: "Delete preset",
    SETTING_DEFAULT_CHANNEL: "Set as the default preset",
    SETTING_DEFAULT_DESC: "Publish with the defualt preset from the context menu of with a keyboard shortcut",
    SETTING_PLACE_HOLDER_NAME: "Enter the preset name...",
    SETTING_PLACEHOLDER_TOKEN: "Enter token...",
    SETTING_PLACEHOLDER_CHAT: "Enter ID...",
    CHANNEL_DEFAULT_NAME: "Channel",
    UNTITLED_CHANNEL: "Unnamed",
    TOOLTIP_EDIT: "Edit name",
    CONFIRM_DELETE_TITLE: "Delete preset?",
    CONFIRM_DELETE_MSG: "Are you sure you want to delete \"{name}\" preset? This action is irreversible.",
    CONFIRM_DELETE_BTN: "Yes, delete",
    CONFIRM_LOGOUT_TITLE: "Log out?",
    CONFIRM_LOGOUT_MSG: "Are you sure you want to log out of your Telegram account?",
    CONFIRM_LOGOUT_BTN: "Log out",
    CONFIRM_CANCEL_BTN: "Cancel",
    COMMAND_SEND_DEFAULT: "Publish with default preset",
    COMMAND_SEND_MULTIPLE: "Publish with advanced settings",
    COMMAND_SEND_TO_PRESET: "Publish to",
    COMMAND_SHOW_FORMATTING_HELP: "Open usage instructions",
    MULTI_PRESET_TITLE: "Advanced publishing settings",
    MULTI_PRESET_CHANNEL_SELECTION: "Choose channels/groups to post to",
    MULTI_PRESET_ADVANCED_FORMATTING: "Advanced formatting",
    MULTI_PRESET_POST_BTN: "Publish",
    MULTI_PRESET_NO_SELECTION: "Choose at least one preset",
    MULTI_PRESET_SILENT_POST_NAME: "Publish silently",
    MULTI_PRESET_SILENT_POST_DESC: "Subscribers will receive a notification without sound",
    MULTI_PRESET_ATTACHMENTS_NAME: "Attachments below the text",
    MULTI_PRESET_ATTACHMENTS_DESC: "Display post text above the attached media files",
    MULTI_PRESET_SCHEDULE_NAME: "Schedule the post",
    MULTI_PRESET_SCHEDULE_DESC: "Leave empty to publish immediately",
    MULTI_PRESET_UPDATE_HEADING: "Edit post",
    MULTI_PRESET_UPDATE_NAME: "Update existing post",
    MULTI_PRESET_UPDATE_NAME_DESC: "Links are stored in the telegram_links property",
    MULTI_PRESET_UPDATE_NO_OPTION: "Choose a link to the post",
    MULTI_PRESET_UPDATE_LINK_LABEL: "{link}", /* REMOVE */
    MULTI_PRESET_UPDATE_NO_LINKS: "No links found in properties",
    MULTI_PRESET_UPDATE_RESOLVING: "Resolving channel…",
    MULTI_PRESET_UPDATE_WILL_USE: "Will update the post in {name}",
    MULTI_PRESET_UPDATE_NO_MATCH: "Matching preset not found!", /* REMOVE ??? */
    MULTI_PRESET_UPDATE_NO_MATCH_NOTICE: "Matching preset not found for this link!",
    SETTING_SAVE_POST_LINKS_NAME: "Save posts links",
    SETTING_SAVE_POST_LINKS_DESC: "If enabled, the link to the published post will be saved to the note's properties",
    SETTING_MD_EMBEDS_AS_COMMENTS_NAME: "Treat .md embeds as post comments",
    SETTING_MD_EMBEDS_AS_COMMENTS_DESC: "If on, after publishing a commentary will be sent with the contents of .md embed",

    AUTH_SECTION_HEADER: "Telegram Account",
    AUTH_CONFIG_URL_NAME: "Config URL",
    AUTH_CONFIG_URL_DESC: "URL of the configuration cloud function",
    AUTH_CONFIG_URL_PLACEHOLDER: "Enter config URL...",
    AUTH_AUTHORIZE_BTN: "Authorize",
    AUTH_NOT_AUTHORIZED: "Not authorized",
    AUTH_AUTHORIZED_AS: "Authorized as: {name}",
    AUTH_LOGOUT_BTN: "Log out",
    AUTH_CANCEL_BTN: "Cancel",
    AUTH_STEP_1: "Authorization: Step 1 of 2",
    AUTH_STEP_2: "Authorization: Step 2 of 2",
    AUTH_PHONE_NOTE: "*Phone number linked to your Telegram account from which publications will be made.",
    AUTH_CODE_NOTE: "*The code will arrive in Telegram",
    AUTH_USE_LOCAL: "Use your own App ID and Hash ID",
    AUTH_APP_ID_PLACEHOLDER: "Enter your own App ID",
    AUTH_HASH_PLACEHOLDER: "Enter your own Hash ID",
    AUTH_NO_CONFIG_URL: "Error: Config URL is not set.",
    AUTH_TITLE: "Telegram Authorization",
    AUTH_PHONE_NAME: "Phone number",
    AUTH_PHONE_DESC: "Enter your Telegram account phone number",
    AUTH_PHONE_PLACEHOLDER: "+1234567890",
    AUTH_SEND_CODE_BTN: "Send code",
    AUTH_CODE_SENT: "Authorization code has been sent to {phone}",
    AUTH_CODE_NAME: "Verification code",
    AUTH_CODE_PLACEHOLDER: "Enter code...",
    AUTH_VERIFY_BTN: "Verify",
    AUTH_PASSWORD_REQUIRED: "Two-factor authentication is enabled. Enter your cloud password.",
    AUTH_PASSWORD_NAME: "Cloud password",
    AUTH_PASSWORD_PLACEHOLDER: "Enter password...",
    AUTH_SUCCESS: "Successfully authorized",
    AUTH_ERROR: "Authorization error",
    AUTH_LOADING: "Please wait...",
    AUTH_LOCAL_BTN: "Own API credentials",
    AUTH_LOCAL_API_ID_NAME: "API ID",
    AUTH_LOCAL_API_ID_DESC: "Get it at my.telegram.org",
    AUTH_LOCAL_API_HASH_NAME: "API Hash",
    AUTH_LOCAL_API_HASH_DESC: "Get it at my.telegram.org",
    AUTH_LOCAL_INVALID_API_ID: "Error: API ID must be a number.",

    FORMATTING_HELP_CONTENT: `
You can open these instructions from the command palette by typing "Publish to Telegram: Open usage instructions".

### Presets

To publish notes to Telegram, you need to configure a preset.

1. Sign in to your Telegram account using the **Telegram Account** section in the plugin settings. You can use the cloud authorization (phone number only) or provide your own API credentials from [my.telegram.org](https://my.telegram.org).

2. Add a new preset and enter the numeric ID or @username of the channel/group where you plan to post. You can find channel/group IDs in the channel/group info in the Telegram app.

Now you can publish notes in Telegram using your preset name via the command palette or the note's context menu.

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
      <td><code>&lt;span class="tg-spoiler"&gt;Spoiler&lt;/span&gt;</code></td>
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
      <td><code>- List</code></td>
      <td><ul><li>List</li></ul></td>
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

#### Splitting a note into multiple posts

You can also use the special command \`<!-- \split -->\` or \`%% \split %%\` to split the text of your note into separate posts. If you use this command, the plugin will publish all posts at the same time. Attachments (see below), including pre-written comments, must appear before the special command that marks the end of the post.

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

Photos and videos can be freely mixed in the same album post. GIFs are always sent as individual animated messages.

### Commentaries

You can pre-write one or more comments for your post that will appear in its discussion right after the publication. To use that feature:

1. In the plugin settings turn on the option "Treat .md embeds as post comments".

2. If a comment on a post is published in a channel, the channel must have a discussion chat linked to it. If a comment on a post is published in a group, it will appear as a regular reply to a message.

3. To prepare a comment for a post, use the \`![[comment-file]]\` embed syntax. Only files with the .md extension are treated comments.

Note that all comments are published with a slight delay.

### Advanced publishing settings

You can call an advanced publishing settings window with command palette (\`Ctrl + P\`) by typing "Publish to Telegram: Publish with advanced settings". In that settings window you can choose to:

* Post to multiple channels/groups at once.
* Post without sound.
* Post with attached media under the text.
* Edit already existing post. Links to the posts are stored in the \`telegram_links\` property, which is filled automatically if the corresponding option is enablen in the settings. You can also create it and fill manually.

### Limits

Standard Telegram posting limits apply to limits of characters per post, limits of attached media size per post, etc. More about that: [https://limits.tginfo.me/](https://limits.tginfo.me/)
`,
};
