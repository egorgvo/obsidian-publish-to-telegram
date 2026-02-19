import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Menu } from "obsidian";
import { t } from "./lang/helpers";

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

        try {
            const content: string = await this.app.vault.read(file);
            const payload = {
                chat_id: this.settings.chatId,
                text: content,
                parse_mode: "Markdown"
            };

            const response = await fetch(`https://api.telegram.org/bot${this.settings.botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Status: ${response.status}`);

            new Notice(t.NOTICE_SUCCESS);
        } catch (err) {
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