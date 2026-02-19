import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu } from "obsidian";
import { t } from "./lang/helpers";
import { convert } from "telegram-markdown-v2";

interface TelegramSettings {
    botToken: string;
    chatId: string;
}

const DEFAULT_SETTINGS: TelegramSettings = {
    botToken: "",
    chatId: ""
}

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;

                menu.addItem((item) => {
                    item
                        .setTitle(t.MENU_TITLE)
                        .setIcon("paper-plane")
                        .onClick(async () => {
                            await this.sendNoteToTelegram(file);
                        });
                });
            })
        );
    }

    async sendNoteToTelegram(file: TFile): Promise<void> {
        if (!this.settings.botToken || !this.settings.chatId) {
            new Notice(t.NOTICE_ERR_CONFIG);
            return;
        }

        const getMimeType = (ext: string) => {
            const map: Record<string, string> = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'webp': 'image/webp'
            };
            return map[ext.toLowerCase()] || 'application/octet-stream';
        };

        try {
            let content: string = await this.app.vault.read(file);
            
            // 1. Extract images
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

            // 2. Prepare text (Remove image syntax and convert to MarkdownV2)
            content = content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/!\[\[.*?\]\]/g, '').trim();
            const formattedContent = convert(content);

            // 3. Logic to send everything as ONE message
            if (imageFiles.length > 0) {
                // If there are images, we attach the text as a CAPTION to the first image
                if (imageFiles.length === 1) {
                    const imgFile = imageFiles[0];
                    const arrayBuffer = await this.app.vault.readBinary(imgFile);
                    const blob = new Blob([arrayBuffer], { type: getMimeType(imgFile.extension) });
                    
                    const formData = new FormData();
                    formData.append("chat_id", this.settings.chatId);
                    formData.append("photo", blob, imgFile.name);
                    formData.append("caption", formattedContent); // Attached here
                    formData.append("parse_mode", "MarkdownV2");

                    const response = await fetch(`https://api.telegram.org/bot${this.settings.botToken}/sendPhoto`, {
                        method: "POST",
                        body: formData
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.description);
                    }
                } else {
                    // Send as Album (Media Group)
                    // Note: Only the FIRST item in the media array should have the caption
                    const formData = new FormData();
                    formData.append("chat_id", this.settings.chatId);
                    
                    const mediaArray = [];
                    for (let j = 0; j < Math.min(imageFiles.length, 10); j++) {
                        const imgFile = imageFiles[j];
                        const attachName = `photo${j}`;
                        
                        mediaArray.push({
                            type: "photo",
                            media: `attach://${attachName}`,
                            caption: j === 0 ? formattedContent : "", // Text goes here
                            parse_mode: j === 0 ? "MarkdownV2" : undefined
                        });
                        
                        const arrayBuffer = await this.app.vault.readBinary(imgFile);
                        const blob = new Blob([arrayBuffer], { type: getMimeType(imgFile.extension) });
                        formData.append(attachName, blob, imgFile.name);
                    }
                    
                    formData.append("media", JSON.stringify(mediaArray));
                    
                    const response = await fetch(`https://api.telegram.org/bot${this.settings.botToken}/sendMediaGroup`, {
                        method: "POST",
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.description);
                    }
                }
            } else if (formattedContent.length > 0) {
                // No images? Send as a regular text message
                const response = await fetch(`https://api.telegram.org/bot${this.settings.botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: this.settings.chatId,
                        text: formattedContent,
                        parse_mode: "MarkdownV2"
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.description);
                }
            }

            new Notice(t.NOTICE_SUCCESS);
        } catch (err: any) {
            console.error(err);
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
        
        containerEl.addClass("telegram-settings-container");

        new Setting(containerEl)
            .setName(t.SETTING_BOT_TOKEN_NAME)
            .setDesc(t.SETTING_BOT_TOKEN_DESC)
            .addText(text => text
                .setPlaceholder(t.SETTING_PLACEHOLDER_TOKEN)
                .setValue(this.plugin.settings.botToken)
                .onChange(async (value) => {
                    this.plugin.settings.botToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t.SETTING_CHAT_ID_NAME)
            .setDesc(t.SETTING_CHAT_ID_DESC)
            .addText(text => text
                .setPlaceholder(t.SETTING_PLACEHOLDER_CHAT)
                .setValue(this.plugin.settings.chatId)
                .onChange(async (value) => {
                    this.plugin.settings.chatId = value;
                    await this.plugin.saveSettings();
                }));
    }
}