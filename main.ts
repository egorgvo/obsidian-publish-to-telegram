import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu, TextComponent, ButtonComponent, Modal } from "obsidian";
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

/**
 * Modal dialog to confirm deletion of a channel preset
 */
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

        contentEl.createEl("p", { 
            text: t.CONFIRM_DELETE_MSG.replace("{name}", this.channelName) 
        });

        const btnContainer = contentEl.createDiv("telegram-modal-buttons");
        
        new ButtonComponent(btnContainer)
            .setButtonText(t.CONFIRM_CANCEL_BTN)
            .onClick(() => this.close());

        new ButtonComponent(btnContainer)
            .setButtonText(t.CONFIRM_DELETE_BTN)
            .setWarning()
            .onClick(() => {
                this.onSubmit();
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        // Add Command for Hotkeys
        this.addCommand({
            id: 'send-to-telegram-default',
            name: t.COMMAND_SEND_DEFAULT,
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                const defaultChannel = this.settings.channels.find(c => c.isDefault);

                if (activeFile && defaultChannel) {
                    if (!checking) {
                        this.sendNoteToTelegram(activeFile, defaultChannel);
                    }
                    return true;
                }

                if (!checking && activeFile && !defaultChannel) {
                    new Notice(t.NOTICE_ERR_NO_DEFAULT);
                }
                
                return false;
            }
        });

        // Register File Menu Event (Right-click)
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                menu.addItem((item) => {
                    item
                        .setTitle(t.MENU_TITLE)
                        .setIcon("paper-plane");
                    
                    const subMenu = (item as any).setSubmenu();
                    this.settings.channels.forEach((channel) => {
                        const displayName = channel.isDefault 
                            ? `⭐ ${channel.name || t.UNTITLED_CHANNEL}` 
                            : channel.name || t.UNTITLED_CHANNEL;

                        subMenu.addItem((subItem: any) => {
                            subItem
                                .setTitle(displayName)
                                .onClick(async () => {
                                    await this.sendNoteToTelegram(file, channel);
                                });
                        });
                    });
                });
            })
        );
    }

    async sendNoteToTelegram(file: TFile, channel: TelegramChannel): Promise<void> {
        if (!channel.botToken || !channel.chatId) {
            new Notice(t.NOTICE_ERR_CONFIG);
            return;
        }

        const getMimeType = (ext: string) => {
            const map: Record<string, string> = {
                'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'webp': 'image/webp'
            };
            return map[ext.toLowerCase()] || 'application/octet-stream';
        };

        try {
            let content: string = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const embeds = cache?.embeds || [];
            const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
            const imageFiles: TFile[] = [];

            for (const embed of embeds) {
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
                if (targetFile instanceof TFile && imageExtensions.includes(targetFile.extension.toLowerCase())) {
                    if (!imageFiles.some(f => f.path === targetFile.path)) {
                        imageFiles.push(targetFile);
                    }
                }
            }

            content = content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/!\[\[.*?\]\]/g, '').trim();
            const formattedContent = convert(content);

            if (imageFiles.length > 0) {
                if (imageFiles.length === 1) {
                    const imgFile = imageFiles[0];
                    const arrayBuffer = await this.app.vault.readBinary(imgFile);
                    const blob = new Blob([arrayBuffer], { type: getMimeType(imgFile.extension) });
                    
                    const formData = new FormData();
                    formData.append("chat_id", channel.chatId);
                    formData.append("photo", blob, imgFile.name);
                    formData.append("caption", formattedContent);
                    formData.append("parse_mode", "MarkdownV2");

                    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendPhoto`, {
                        method: "POST",
                        body: formData
                    });
                    if (!response.ok) throw new Error((await response.json()).description);
                } else {
                    const formData = new FormData();
                    formData.append("chat_id", channel.chatId);
                    const mediaArray = [];
                    for (let j = 0; j < Math.min(imageFiles.length, 10); j++) {
                        const imgFile = imageFiles[j];
                        const attachName = `photo${j}`;
                        mediaArray.push({
                            type: "photo",
                            media: `attach://${attachName}`,
                            caption: j === 0 ? formattedContent : "",
                            parse_mode: j === 0 ? "MarkdownV2" : undefined
                        });
                        const arrayBuffer = await this.app.vault.readBinary(imgFile);
                        formData.append(attachName, new Blob([arrayBuffer], { type: getMimeType(imgFile.extension) }), imgFile.name);
                    }
                    formData.append("media", JSON.stringify(mediaArray));
                    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMediaGroup`, {
                        method: "POST",
                        body: formData
                    });
                    if (!response.ok) throw new Error((await response.json()).description);
                }
            } else if (formattedContent.length > 0) {
                const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: channel.chatId,
                        text: formattedContent,
                        parse_mode: "MarkdownV2"
                    })
                });
                if (!response.ok) throw new Error((await response.json()).description);
            }

            new Notice(t.NOTICE_SUCCESS);
        } catch (err: any) {
            new Notice(`${t.NOTICE_ERR_SEND}${err.message}`);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class TelegramSettingTab extends PluginSettingTab {
    plugin: SendToTelegramPlugin;

    constructor(app: App, plugin: SendToTelegramPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setHeading()
            .setName(t.SETTING_HEADER);

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText(t.SETTING_ADD_CHANNEL)
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.channels.push({
                        id: Date.now().toString(),
                        name: "",
                        botToken: "",
                        chatId: "",
                        isDefault: false
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // FIXED: Using containerEl instead of the non-existent channelEl
        const channelContainer = containerEl.createDiv("telegram-settings-container");

        this.plugin.settings.channels.forEach((channel, index) => {
            const channelDiv = channelContainer.createDiv("telegram-channel-item");
            const header = channelDiv.createDiv("telegram-channel-header");
            
            const titleContainer = header.createDiv("telegram-header-title-container");
            const headerTitle = titleContainer.createEl("span", { 
                text: channel.name || `${t.CHANNEL_DEFAULT_NAME} ${index + 1}`,
                cls: "telegram-header-name"
            });

            const editBtnContainer = titleContainer.createDiv("telegram-edit-container");
            const editBtn = new ButtonComponent(editBtnContainer)
                .setIcon("pencil")
                .setTooltip(t.TOOLTIP_EDIT)
                .onClick(() => {
                    titleContainer.empty();
                    const input = new TextComponent(titleContainer)
                        .setValue(channel.name)
                        .setPlaceholder(t.SETTING_PLACE_HOLDER_NAME);
                    
                    input.inputEl.focus();
                    input.inputEl.addEventListener("blur", async () => {
                        channel.name = input.getValue();
                        await this.plugin.saveSettings();
                        this.display();
                    });

                    input.inputEl.addEventListener("keypress", async (e) => {
                        if (e.key === "Enter") input.inputEl.blur();
                    });
                });
            editBtn.buttonEl.addClass("telegram-edit-button");

            const deleteBtnContainer = header.createDiv("telegram-delete-container");
            const deleteBtn = new ButtonComponent(deleteBtnContainer)
                .setIcon("trash")
                .setTooltip(t.SETTING_DELETE_CHANNEL)
                .onClick(async () => {
                    new ConfirmationModal(this.app, channel.name, async () => {
                        this.plugin.settings.channels.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }).open();
                });
            deleteBtn.buttonEl.addClass("telegram-delete-button");

            new Setting(channelDiv)
                .setName(t.SETTING_BOT_TOKEN_NAME)
                .setDesc(t.SETTING_BOT_TOKEN_DESC)
                .addText(text => text
                    .setPlaceholder(t.SETTING_PLACEHOLDER_TOKEN)
                    .setValue(channel.botToken)
                    .onChange(async (value) => {
                        channel.botToken = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(channelDiv)
                .setName(t.SETTING_CHAT_ID_NAME)
                .setDesc(t.SETTING_CHAT_ID_DESC)
                .addText(text => text
                    .setPlaceholder(t.SETTING_PLACEHOLDER_CHAT)
                    .setValue(channel.chatId)
                    .onChange(async (value) => {
                        channel.chatId = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(channelDiv)
                .setName(t.SETTING_DEFAULT_CHANNEL)
                .setDesc(t.SETTING_DEFAULT_DESC)
                .addToggle(toggle => toggle
                    .setValue(channel.isDefault || false)
                    .onChange(async (value) => {
                        if (value) {
                            this.plugin.settings.channels.forEach(c => c.isDefault = false);
                            channel.isDefault = true;
                        } else {
                            channel.isDefault = false;
                        }
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });
    }
}