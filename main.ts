import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu, TextComponent, ButtonComponent, Modal, ToggleComponent, MarkdownRenderer } from "obsidian";
import { t } from "./lang/helpers";
import { convert } from "telegram-markdown-v2";

interface TelegramChannel {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
    isDefault: boolean;
}

interface TelegramSettings {
    channels: TelegramChannel[];
}

const DEFAULT_SETTINGS: TelegramSettings = {
    channels: []
}

// ─── Formatting Help Modal ────────────────────────────────────────────────────
// Edit FORMATTING_HELP_CONTENT below to update the instructions shown in the
// modal. Full Obsidian-flavoured Markdown is supported, including tables.

const FORMATTING_HELP_CONTENT = `

### Formatting elements

All standard Telegram formatting options are supported:

| Formatting element          | Input in Obsidian                      | Telegram Output    |
| ----------------------------| -------------------------------------- | -------------------|
| **Bold**                    | \`**text**\`                           | \`*text*\`         |
| _Italic_                    | \`*text*\`                             | \`_text_\`         |
| **Underline**               | \`<u>text</u>\`                        | \`__text__\`       |
| ~~Strikethrough~~           | \`~~text~~\`                           | \`~text~\`         |
| Spoiler                     | \`<span class="tg-spoiler">text</span>\`| \`                |
| \`Inline Code\`             | \`\` \`code\` \`\`                     | \`\` \`code\` \`\` |
| [Links](https://obsdian.md) | \`[text](url)\`                        | \`[text](url)\`    |
| Block Quotes                | \`> quote\`                            | > quote            |
| Code Blocks                 | lang code                              | code               |
| Lists                       | \`- item\`                             | \`• item\`         |
| Headings                    | \`# Title\`                            | \`*Title*\`        |

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
`;

class FormattingHelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(t.SETTING_FORMATTING_HELP);
        contentEl.addClass("telegram-formatting-help-modal");
        MarkdownRenderer.render(
            this.app,
            FORMATTING_HELP_CONTENT,
            contentEl,
            "",
            this
        );
    }

    onClose() { this.contentEl.empty(); }
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

class ConfirmationModal extends Modal {
    onSubmit: () => void;
    channelName: string;

    constructor(app: App, channelName: string, onSubmit: () => void) {
        super(app);
        this.channelName = channelName || t.UNTITLED_CHANNEL;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(t.CONFIRM_DELETE_TITLE);
        contentEl.createEl("p", { text: t.CONFIRM_DELETE_MSG.replace("{name}", this.channelName) });
        const btnContainer = contentEl.createDiv("telegram-modal-buttons");
        new ButtonComponent(btnContainer).setButtonText(t.CONFIRM_CANCEL_BTN).onClick(() => this.close());
        new ButtonComponent(btnContainer).setButtonText(t.CONFIRM_DELETE_BTN).setWarning().onClick(() => {
            this.onSubmit();
            this.close();
        });
    }

    onClose() { this.contentEl.empty(); }
}


class MultiPresetModal extends Modal {
    plugin: SendToTelegramPlugin;
    selectedChannels: Set<string>;
    file: TFile;

    private silentToggle: ToggleComponent;
    private attachToggle: ToggleComponent;

    constructor(app: App, plugin: SendToTelegramPlugin, file: TFile) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.selectedChannels = new Set();
    }

    private resetAdvancedSettings() {
        this.silentToggle?.setValue(false);
        this.attachToggle?.setValue(false);
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(t.MULTI_PRESET_TITLE);

        if (this.plugin.settings.channels.length === 0) {
            contentEl.createEl("p", { text: t.NOTICE_ERR_CONFIG });
            return;
        }

        contentEl.createDiv({ 
            text: t.MULTI_PRESET_CHANNEL_SELECTION, 
            cls: "telegram-modal-heading" 
        });

        const listContainer = contentEl.createDiv("telegram-multi-preset-list");

        this.plugin.settings.channels.forEach(channel => {
            const itemEl = listContainer.createDiv("telegram-multi-preset-item");
            const nameEl = itemEl.createDiv("telegram-multi-preset-name");
            nameEl.setText(channel.isDefault 
                ? `${channel.name || t.UNTITLED_CHANNEL}` 
                : channel.name || t.UNTITLED_CHANNEL);

            const controlEl = itemEl.createDiv("telegram-multi-preset-control");
            new ToggleComponent(controlEl)
                .setValue(false)
                .onChange(value => {
                    if (value) this.selectedChannels.add(channel.id);
                    else this.selectedChannels.delete(channel.id);
                });
        });

        contentEl.createDiv({ 
            text: t.MULTI_PRESET_ADVANCED_FORMATTING, 
            cls: "telegram-modal-heading" 
        });

        const silentOptionEl = contentEl.createDiv("telegram-option-item");
        const silentTextEl = silentOptionEl.createDiv("telegram-option-text");
        silentTextEl.createDiv({ text: t.MULTI_PRESET_SILENT_POST_NAME, cls: "telegram-option-name" });
        silentTextEl.createDiv({ text: t.MULTI_PRESET_SILENT_POST_DESC, cls: "telegram-option-desc" });
        this.silentToggle = new ToggleComponent(silentOptionEl.createDiv("telegram-option-control"))
            .setValue(false);

        const attachOptionEl = contentEl.createDiv("telegram-option-item");
        const attachTextEl = attachOptionEl.createDiv("telegram-option-text");
        attachTextEl.createDiv({ text: t.MULTI_PRESET_ATTACHMENTS_NAME, cls: "telegram-option-name" });
        attachTextEl.createDiv({ text: t.MULTI_PRESET_ATTACHMENTS_DESC, cls: "telegram-option-desc" });
        this.attachToggle = new ToggleComponent(attachOptionEl.createDiv("telegram-option-control"))
            .setValue(false);

        const btnContainer = contentEl.createDiv("telegram-modal-buttons");
        new ButtonComponent(btnContainer)
            .setButtonText(t.MULTI_PRESET_POST_BTN)
            .setCta()
            .onClick(async () => {
                if (this.selectedChannels.size === 0) {
                    new Notice(t.MULTI_PRESET_NO_SELECTION);
                    return;
                }
                const channelsToPost = this.plugin.settings.channels.filter(c => this.selectedChannels.has(c.id));
                const silent = this.silentToggle?.getValue() ?? false;
                const attachUnderText = this.attachToggle?.getValue() ?? false;
                this.resetAdvancedSettings();
                this.close();
                for (const channel of channelsToPost) {
                    await this.plugin.sendNoteToTelegram(this.file, channel, silent, attachUnderText);
                }
            });
    }

    onClose() { this.contentEl.empty(); }
}


export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    // Tracks the fully-qualified command IDs (manifest.id + ":" + command.id) of all
    // currently registered per-channel commands so they can be torn down before
    // re-registration. Obsidian does not expose removeCommand() in its public TS types
    // but the method exists at runtime on app.commands and is the standard approach
    // used by community plugins to manage dynamically registered commands.
    private channelCommandIds: string[] = [];

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        // Static utility commands — registered once on load, never torn down.
        this.registerStaticCommands();

        // Per-preset commands — registered now and refreshed after every settings change.
        this.syncChannelCommands();

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                menu.addItem((item) => {
                    item.setTitle(t.MENU_TITLE).setIcon("paper-plane");
                    item.onClick(() => {
                        const defaultChannel = this.settings.channels.find(c => c.isDefault);
                        if (!defaultChannel) {
                            new Notice(t.NOTICE_ERR_NO_DEFAULT);
                            return;
                        }
                        this.sendNoteToTelegram(file, defaultChannel, false, false);
                    });
                });
            })
        );
    }

    // Registers the two commands that are independent of preset configuration.
    // Must only be called once — calling addCommand() with the same id a second
    // time silently replaces the first registration in most Obsidian versions,
    // but separating it here avoids any ambiguity.
    private registerStaticCommands() {
        this.addCommand({
            id: "send-default",
            name: t.COMMAND_SEND_DEFAULT,
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (!file) return;
                const defaultChannel = this.settings.channels.find(c => c.isDefault);
                if (!defaultChannel) { new Notice(t.NOTICE_ERR_NO_DEFAULT); return; }
                await this.sendNoteToTelegram(file, defaultChannel, false, false);
            }
        });

        this.addCommand({
            id: "send-multiple",
            name: t.COMMAND_SEND_MULTIPLE,
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (!file) return;
                if (this.settings.channels.length === 0) { new Notice(t.NOTICE_ERR_CONFIG); return; }
                new MultiPresetModal(this.app, this, file).open();
            }
        });
    }

    // Removes every previously registered per-channel command from the palette,
    // then creates a fresh command for each channel that exists in current settings.
    // This keeps the palette perfectly in sync after any preset add / rename / delete.
    syncChannelCommands() {
        const commands = (this.app as any).commands;
        this.channelCommandIds.forEach(id => commands.removeCommand(id));
        this.channelCommandIds = [];

        this.settings.channels.forEach(channel => {
            const commandId = `send-channel-${channel.id}`;
            this.addCommand({
                id: commandId,
                name: `${t.COMMAND_SEND_TO_PRESET} ${channel.name || t.UNTITLED_CHANNEL}`,
                callback: async () => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file) return;
                    await this.sendNoteToTelegram(file, channel, false, false);
                }
            });
            this.channelCommandIds.push(`${this.manifest.id}:${commandId}`);
        });
    }

    async sendNoteToTelegram(file: TFile, channel: TelegramChannel, silent: boolean, attachUnderText: boolean): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const formattedContent = convert(content);
            const attachments = file.parent ? this.app.vault.getFiles().filter(f =>
                f.parent?.path === file.parent?.path &&
                f.name !== file.name &&
                (f.extension === "jpg" || f.extension === "jpeg" || f.extension === "png" || f.extension === "gif" || f.extension === "webp" || f.extension === "pdf")
            ) : [];

            const photoFiles = attachments.filter(f => ["jpg", "jpeg", "png", "gif", "webp"].includes(f.extension));
            const docFiles = attachments.filter(f => f.extension === "pdf");

            if (photoFiles.length > 0) {
                const firstBatch = photoFiles.slice(0, 10);
                const remainingPhotos = photoFiles.slice(10);
                if (firstBatch.length === 1) {
                    await this.sendSingleMedia(channel, firstBatch[0], "photo", formattedContent, silent, attachUnderText);
                } else {
                    await this.sendMediaGroup(channel, firstBatch, "photo", formattedContent, silent, attachUnderText);
                }
                for (const photo of remainingPhotos) await this.sendSingleMedia(channel, photo, "photo", "", silent, false);
            }
            else if (docFiles.length > 0) {
                const firstBatch = docFiles.slice(0, 10);
                const remainingDocs = docFiles.slice(10);
                if (firstBatch.length === 1) {
                    await this.sendSingleMedia(channel, firstBatch[0], "document", formattedContent, silent, attachUnderText);
                } else {
                    await this.sendMediaGroup(channel, firstBatch, "document", formattedContent, silent, attachUnderText);
                }
                for (const doc of remainingDocs) await this.sendSingleMedia(channel, doc, "document", "", silent, false);
            } 
            else if (formattedContent.length > 0) {
                await this.sendTextMessage(channel, formattedContent, silent);
            }

            new Notice(t.NOTICE_SUCCESS);
        } catch (err: any) {
            new Notice(`${t.NOTICE_ERR_SEND}${err.message}`);
        }
    }

    async sendTextMessage(channel: TelegramChannel, text: string, silent: boolean) {
        const body: Record<string, unknown> = {
            chat_id: channel.chatId,
            text,
            parse_mode: "MarkdownV2",
        };
        if (silent) body.disable_notification = true;

        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error((await response.json()).description);
    }

    async sendSingleMedia(channel: TelegramChannel, file: TFile, type: "photo" | "document", caption: string, silent: boolean, attachUnderText: boolean) {
        const method = type === "photo" ? "sendPhoto" : "sendDocument";
        const formData = new FormData();
        formData.append("chat_id", channel.chatId);
        formData.append(type, new Blob([await this.app.vault.readBinary(file)]), file.name);
        if (caption) {
            formData.append("caption", caption);
            formData.append("parse_mode", "MarkdownV2");
        }
        if (silent) formData.append("disable_notification", "true");
        if (attachUnderText) formData.append("show_caption_above_media", "true");

        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/${method}`, { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).description);
    }

    async sendMediaGroup(channel: TelegramChannel, files: TFile[], type: "photo" | "document", caption: string, silent: boolean, attachUnderText: boolean) {
        const formData = new FormData();
        formData.append("chat_id", channel.chatId);
        if (silent) formData.append("disable_notification", "true");

        const mediaArray = await Promise.all(files.map(async (file, idx) => {
            const attachName = `file${idx}`;
            formData.append(attachName, new Blob([await this.app.vault.readBinary(file)]), file.name);
            return {
                type: type,
                media: `attach://${attachName}`,
                ...(idx === 0 && caption ? {
                    caption,
                    parse_mode: "MarkdownV2",
                    show_caption_above_media: attachUnderText
                } : {})
            };
        }));

        formData.append("media", JSON.stringify(mediaArray));
        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMediaGroup`, { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).description);
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() {
        await this.saveData(this.settings);
        // Rebuild per-channel commands to reflect any additions, deletions, or renames.
        this.syncChannelCommands();
    }
}

class TelegramSettingTab extends PluginSettingTab {
    plugin: SendToTelegramPlugin;
    constructor(app: App, plugin: SendToTelegramPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl).setHeading().setName(t.SETTING_HEADER);

        containerEl.createEl("p", { text: t.SETTING_DESCRIPTION, cls: "telegram-plugin-description" });

        const addSection = containerEl.createDiv("telegram-add-preset-section");
        const infoDiv = addSection.createDiv("telegram-add-preset-info");
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_NAME, cls: "telegram-add-preset-title" });
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_DESC, cls: "telegram-add-preset-description" });

        const buttonContainer = addSection.createDiv("telegram-add-preset-button-container");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_OPEN_BOTFATHER)
            .onClick(() => {
                window.open("https://t.me/BotFather", "_blank");
            }).buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_OPEN_USERINFOBOT)
            .onClick(() => {
                window.open("https://t.me/userinfobot", "_blank");
            }).buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_FORMATTING_HELP)
            .onClick(() => {
                new FormattingHelpModal(this.app).open();
            }).buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_ADD_CHANNEL)
            .onClick(async () => {
                this.plugin.settings.channels.unshift({ id: Date.now().toString(), name: "", botToken: "", chatId: "", isDefault: false });
                await this.plugin.saveSettings();
                this.display();
            }).buttonEl.addClass("telegram-add-button");

        this.plugin.settings.channels.forEach((channel, index) => {
            const channelDiv = containerEl.createDiv("telegram-channel-item");
            const header = channelDiv.createDiv("telegram-channel-header");
            const titleContainer = header.createDiv("telegram-header-title-container");
            titleContainer.createEl("span", { text: channel.name || `${t.CHANNEL_DEFAULT_NAME} ${index + 1}`, cls: "telegram-header-name" });

            new ButtonComponent(titleContainer.createDiv("telegram-edit-container"))
                .setIcon("pencil").onClick(() => {
                    titleContainer.empty();
                    const input = new TextComponent(titleContainer)
                        .setValue(channel.name)
                        .setPlaceholder(t.SETTING_PLACE_HOLDER_NAME);
                    input.inputEl.focus();

                    let saved = false;
                    const save = async () => {
                        if (saved) return;
                        saved = true;
                        channel.name = input.getValue();
                        await this.plugin.saveSettings();
                        this.display();
                    };

                    input.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            save();
                        }
                    });
                    input.inputEl.addEventListener("blur", save);
                }).buttonEl.addClass("telegram-edit-button");

            new ButtonComponent(header.createDiv("telegram-delete-container"))
                .setIcon("trash").onClick(async () => {
                    new ConfirmationModal(this.app, channel.name, async () => {
                        this.plugin.settings.channels.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }).open();
                }).buttonEl.addClass("telegram-delete-button");

            new Setting(channelDiv).setName(t.SETTING_BOT_TOKEN_NAME).setDesc(t.SETTING_BOT_TOKEN_DESC)
                .addText(text => text.setPlaceholder(t.SETTING_PLACEHOLDER_TOKEN).setValue(channel.botToken)
                    .onChange(async (v) => { channel.botToken = v; await this.plugin.saveSettings(); }));

            new Setting(channelDiv).setName(t.SETTING_CHAT_ID_NAME).setDesc(t.SETTING_CHAT_ID_DESC)
                .addText(text => text.setPlaceholder(t.SETTING_PLACEHOLDER_CHAT).setValue(channel.chatId)
                    .onChange(async (v) => { channel.chatId = v; await this.plugin.saveSettings(); }));

            new Setting(channelDiv).setName(t.SETTING_DEFAULT_CHANNEL).setDesc(t.SETTING_DEFAULT_DESC)
                .addToggle(toggle => toggle.setValue(channel.isDefault || false)
                    .onChange(async (v) => {
                        if (v) this.plugin.settings.channels.forEach(c => c.isDefault = false);
                        channel.isDefault = v;
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });
    }
}