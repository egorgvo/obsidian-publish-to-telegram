export default {
    MENU_TITLE: "Publish to Telegram",
    NOTICE_SUCCESS: "Successfully published ✅",
    NOTICE_ERR_CONFIG: "Error: Set up at least one preset.",
    NOTICE_ERR_SEND: "Publishing error: ",
    NOTICE_ERR_NO_DEFAULT: "Error: Default preset is not set up.",
    NOTICE_ERR_INCOMPLETE_PRESET: "Error: Bot token and Chat ID must both be filled in before publishing.",
    SETTING_HEADER: "Publish to Telegram Settings",
    SETTING_DESCRIPTION: "Plugin allows you to post active note to Telegram with hotkeys, command palette and from context menus. Standard Telegram text formatting is supported, as well as photo, album and documents uploads. Advanced publishing settings are available: post to multiple channels/groups at once, silent post and posting media under the text.",
    SETTING_ADD_CHANNEL_NAME: "Set up instructions",
    SETTING_ADD_CHANNEL_DESC: `Plugin works through your personal bot, sending him contents of active note and information about the channel/group to post to. For security reasons, do not transfer control of your bot to third parties.

1. Create a bot using @BotFather and paste its token into the corresponding field in the plugin.
2. Find out your channel/group ID using @userinfobot and paste it into the corresponding field in the plugin.
3. Add your bot to the channel/group and give it permission to send messages.`,
    SETTING_ADD_CHANNEL: "Create new preset",
    SETTING_FORMATTING_HELP: "Formatting instructions",
    SETTING_OPEN_BOTFATHER: "Open @BotFather",
    SETTING_OPEN_USERINFOBOT: "Open @userinfobot",
    SETTING_BOT_TOKEN_NAME: "You bot token",
    SETTING_BOT_TOKEN_DESC: "Get it from @BotFather",
    SETTING_CHAT_ID_NAME: "Target channel/group ID",
    SETTING_CHAT_ID_DESC: "Get it from @userinfobot",
    SETTING_DELETE_CHANNEL: "Delete preset",
    SETTING_DEFAULT_CHANNEL: "Set as default preset",
    SETTING_DEFAULT_DESC: "You can publish with default preset using a keyboard shortcut.",
    SETTING_PLACE_HOLDER_NAME: "Enter the preset name...",
    SETTING_PLACEHOLDER_TOKEN: "Enter token...",
    SETTING_PLACEHOLDER_CHAT: "Enter ID...",
    CHANNEL_DEFAULT_NAME: "Channel",
    UNTITLED_CHANNEL: "Unnamed",
    TOOLTIP_EDIT: "Edit name",
    CONFIRM_DELETE_TITLE: "Delete preset?",
    CONFIRM_DELETE_MSG: "Are you sure you want to delete \“{name}\” preset? This action is irreversible.",
    CONFIRM_DELETE_BTN: "Yes, delete",
    CONFIRM_CANCEL_BTN: "Cancel",
    COMMAND_SEND_DEFAULT: "Publish with default preset",
    COMMAND_SEND_MULTIPLE: "Publish with advanced settings",
    COMMAND_SEND_TO_PRESET: "Publish to",
    COMMAND_SHOW_FORMATTING_HELP: "Open formatting instructions",
    MULTI_PRESET_TITLE: "Advanced publishing settings",
    MULTI_PRESET_CHANNEL_SELECTION: "Choose channels/groups to post to",
    MULTI_PRESET_ADVANCED_FORMATTING: "Advanced formatting",
    MULTI_PRESET_POST_BTN: "Publish",
    MULTI_PRESET_NO_SELECTION: "Choose at least one preset",
    MULTI_PRESET_SILENT_POST_NAME: "Publish silently",
    MULTI_PRESET_SILENT_POST_DESC: "Subscribers will receive a notification without sound",
    MULTI_PRESET_ATTACHMENTS_NAME: "Attachments below the text",
    MULTI_PRESET_ATTACHMENTS_DESC: "Display post text above the attached media files",
   
    FORMATTING_HELP_CONTENT: `
You can show open these formatting instructions from the command palette by typing "Publish to Telegram: Open formatting instructions".

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
  </tbody>
</table>

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