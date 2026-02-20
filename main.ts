import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu, TextComponent, ButtonComponent, Modal, ToggleComponent } from "obsidian";
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
    disableNotification: boolean = false;
    attachmentsUnderText: boolean = false;

    constructor(app: App, plugin: SendToTelegramPlugin, file: TFile) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.selectedChannels = new Set();
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(t.MULTI_PRESET_TITLE);

        if (this.plugin.settings.channels.length === 0) {
            contentEl.createEl("p", { text: t.NOTICE_ERR_CONFIG });
            return;
        }

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

        // Silent Post Option
        const silentOptionEl = contentEl.createDiv("telegram-option-item");
        const silentTextEl = silentOptionEl.createDiv("telegram-option-text");
        silentTextEl.createDiv({ text: t.MULTI_PRESET_SILENT_POST_NAME, cls: "telegram-option-name" });
        silentTextEl.createDiv({ text: t.MULTI_PRESET_SILENT_POST_DESC, cls: "telegram-option-desc" });
        new ToggleComponent(silentOptionEl.createDiv("telegram-option-control"))
            .setValue(this.disableNotification)
            .onChange(value => this.disableNotification = value);

        // Attachments Under Text Option
        const attachOptionEl = contentEl.createDiv("telegram-option-item");
        const attachTextEl = attachOptionEl.createDiv("telegram-option-text");
        attachTextEl.createDiv({ text: t.MULTI_PRESET_ATTACHMENTS_NAME, cls: "telegram-option-name" });
        attachTextEl.createDiv({ text: t.MULTI_PRESET_ATTACHMENTS_DESC, cls: "telegram-option-desc" });
        new ToggleComponent(attachOptionEl.createDiv("telegram-option-control"))
            .setValue(this.attachmentsUnderText)
            .onChange(value => this.attachmentsUnderText = value);

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
                this.close();
                for (const channel of channelsToPost) {
                    await this.plugin.sendNoteToTelegram(this.file, channel, this.disableNotification, this.attachmentsUnderText);
                }
            });
    }

    onClose() { this.contentEl.empty(); }
}

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));
        this.registerChannelCommands();

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                menu.addItem((item) => {
                    item.setTitle(t.MENU_TITLE).setIcon("paper-plane");
                    const subMenu = (item as any).setSubmenu();
                    this.settings.channels.forEach((channel) => {
                        const displayName = channel.isDefault 
                            ? `${channel.name || t.UNTITLED_CHANNEL}` 
                            : channel.name || t.UNTITLED_CHANNEL;

                        subMenu.addItem((subItem: any) => {
                            subItem.setTitle(displayName).onClick(async () => {
                                await this.sendNoteToTelegram(file, channel);
                            });
                        });
                    });
                });
            })
        );
    }

    registerChannelCommands() {
        this.addCommand({
            id: 'send-to-telegram-default',
            name: t.COMMAND_SEND_DEFAULT,
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                const defaultChannel = this.settings.channels.find(c => c.isDefault);
                if (activeFile && defaultChannel) {
                    if (!checking) this.sendNoteToTelegram(activeFile, defaultChannel);
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'send-to-telegram-multiple',
            name: t.COMMAND_SEND_MULTIPLE,
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && this.settings.channels.length > 0) {
                    if (!checking) new MultiPresetModal(this.app, this, activeFile).open();
                    return true;
                }
                return false;
            }
        });
    }

    async sendNoteToTelegram(file: TFile, channel: TelegramChannel, silent: boolean = false, attachUnderText: boolean = false): Promise<void> {
        if (!channel.botToken || !channel.chatId) {
            new Notice(t.NOTICE_ERR_CONFIG);
            return;
        }

        try {
            let content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const embeds = cache?.embeds || [];
            
            const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
            const imageFiles: TFile[] = [];
            const docFiles: TFile[] = [];

            for (const embed of embeds) {
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
                if (targetFile instanceof TFile) {
                    if (imageExts.includes(targetFile.extension.toLowerCase())) {
                        if (!imageFiles.some(f => f.path === targetFile.path)) imageFiles.push(targetFile);
                    } else {
                        if (!docFiles.some(f => f.path === targetFile.path)) docFiles.push(targetFile);
                    }
                }
            }

            content = content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/!\[\[.*?\]\]/g, '').trim();
            const formattedContent = convert(content);

            // LOGIC: Attach text to the first group/file sent.
            if (imageFiles.length > 0) {
                // Send images with text as caption
                if (imageFiles.length === 1) {
                    await this.sendSingleMedia(channel, imageFiles[0], "photo", formattedContent, silent, attachUnderText);
                } else {
                    await this.sendMediaGroup(channel, imageFiles.slice(0, 10), "photo", formattedContent, silent, attachUnderText);
                }
                // Send docs afterward (no caption)
                for (const doc of docFiles) await this.sendSingleMedia(channel, doc, "document", "", silent, false);
            } 
            else if (docFiles.length > 0) {
                // No images. Send first batch of documents with the text as caption
                const firstBatch = docFiles.slice(0, 10);
                const remainingDocs = docFiles.slice(10);

                if (firstBatch.length === 1) {
                    await this.sendSingleMedia(channel, firstBatch[0], "document", formattedContent, silent, attachUnderText);
                } else {
                    await this.sendMediaGroup(channel, firstBatch, "document", formattedContent, silent, attachUnderText);
                }
                // Send any remaining documents
                for (const doc of remainingDocs) await this.sendSingleMedia(channel, doc, "document", "", silent, false);
            } 
            else if (formattedContent.length > 0) {
                // Just text
                await this.sendTextMessage(channel, formattedContent, silent);
            }

            new Notice(t.NOTICE_SUCCESS);
        } catch (err: any) {
            new Notice(`${t.NOTICE_ERR_SEND}${err.message}`);
        }
    }

    async sendTextMessage(channel: TelegramChannel, text: string, silent: boolean) {
        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                chat_id: channel.chatId, text, parse_mode: "MarkdownV2", disable_notification: silent 
            })
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
        formData.append("disable_notification", String(silent));
        // Use show_caption_above_media if requested
        if (attachUnderText) formData.append("show_caption_above_media", "true");

        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/${method}`, { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).description);
    }

    async sendMediaGroup(channel: TelegramChannel, files: TFile[], type: "photo" | "document", caption: string, silent: boolean, attachUnderText: boolean) {
        const formData = new FormData();
        formData.append("chat_id", channel.chatId);
        formData.append("disable_notification", String(silent));

        const mediaArray = await Promise.all(files.map(async (file, idx) => {
            const attachName = `file${idx}`;
            formData.append(attachName, new Blob([await this.app.vault.readBinary(file)]), file.name);
            return {
                type: type,
                media: `attach://${attachName}`,
                caption: idx === 0 ? caption : "",
                parse_mode: idx === 0 && caption ? "MarkdownV2" : undefined,
                show_caption_above_media: attachUnderText
            };
        }));

        formData.append("media", JSON.stringify(mediaArray));
        const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMediaGroup`, { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).description);
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { 
        await this.saveData(this.settings);
        this.registerChannelCommands();
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

        new ButtonComponent(addSection.createDiv("telegram-add-preset-button-container"))
            .setButtonText(t.SETTING_ADD_CHANNEL)
            .onClick(async () => {
                this.plugin.settings.channels.push({ id: Date.now().toString(), name: "", botToken: "", chatId: "", isDefault: false });
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
                    const input = new TextComponent(titleContainer).setValue(channel.name).setPlaceholder(t.SETTING_PLACE_HOLDER_NAME);
                    input.inputEl.focus();
                    input.inputEl.addEventListener("blur", async () => {
                        channel.name = input.getValue();
                        await this.plugin.saveSettings();
                        this.display();
                    });
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