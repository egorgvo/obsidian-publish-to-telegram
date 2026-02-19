import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu } from "obsidian";
import { t } from "./lang/helpers";
import { convert } from "telegram-markdown-v2";

interface TelegramChannel {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
}

interface TelegramSettings {
    channels: TelegramChannel[];
}

const DEFAULT_SETTINGS: TelegramSettings = {
    channels: []
}

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                if (this.settings.channels.length === 1) {
                    // Single channel: direct item
                    menu.addItem((item) => {
                        item
                            .setTitle(t.MENU_TITLE)
                            .setIcon("paper-plane")
                            .onClick(async () => {
                                await this.sendNoteToTelegram(file, this.settings.channels[0]);
                            });
                    });
                } else {
                    // Multiple channels: Submenu
                    menu.addItem((item) => {
                        item
                            .setTitle(t.MENU_TITLE)
                            .setIcon("paper-plane");
                        
                        const subMenu = (item as any).setSubmenu();
                        this.settings.channels.forEach((channel) => {
                            subMenu.addItem((subItem: any) => {
                                subItem
                                    .setTitle(channel.name || "Untitled Channel")
                                    .onClick(async () => {
                                        await this.sendNoteToTelegram(file, channel);
                                    });
                            });
                        });
                    });
                }
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

        const channelContainer = containerEl.createDiv("telegram-settings-container");

        this.plugin.settings.channels.forEach((channel, index) => {
            const channelDiv = channelContainer.createDiv("telegram-channel-item");
            
            const header = channelDiv.createDiv("telegram-channel-header");
            header.setText(`${channel.name || "Channel " + (index + 1)}`);

            new Setting(channelDiv)
                .setName(t.SETTING_CHANNEL_NAME)
                .addText(text => text
                    .setPlaceholder(t.SET_PLACE_NAME)
                    .setValue(channel.name)
                    .onChange(async (value) => {
                        channel.name = value;
                        header.setText(value || "Untitled Channel");
                        await this.plugin.saveSettings();
                    }));

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
                .addButton(btn => btn
                    .setButtonText(t.SETTING_DELETE_CHANNEL)
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.channels.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText(t.SETTING_ADD_CHANNEL)
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.channels.push({
                        id: Date.now().toString(),
                        name: "",
                        botToken: "",
                        chatId: ""
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
}