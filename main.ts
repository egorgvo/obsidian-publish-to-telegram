import { Plugin, Notice, TFile, TFolder, Menu } from "obsidian";
import { t } from "./lang/helpers";
import { TelegramChannel, TelegramSettings, DEFAULT_SETTINGS } from "./src/types";
import { sendNoteToTelegram } from "./src/telegram";
import { FormattingHelpModal, MultiPresetModal, TelegramSettingTab } from "./src/gui";

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;

    private channelCommandIds: string[] = [];

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        this.registerStaticCommands();

        this.syncChannelCommands();

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                menu.addItem((item) => {
                    item.setTitle(t.MENU_TITLE).setIcon("paper-plane");
                    item.onClick(async () => {
                        const defaultChannel = await this.resolveDefaultChannel();
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

    private registerStaticCommands() {
        this.addCommand({
            id: "send-default",
            name: t.COMMAND_SEND_DEFAULT,
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (!file) return;
                const defaultChannel = await this.resolveDefaultChannel();
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

        this.addCommand({
            id: "show-formatting-help",
            name: t.COMMAND_SHOW_FORMATTING_HELP,
            callback: () => {
                new FormattingHelpModal(this.app, this).open();
            }
        });
    }

    // If no preset is set as default but only one exists, that preset is set as default
    async resolveDefaultChannel(): Promise<TelegramChannel | undefined> {
        const explicit = this.settings.channels.find(c => c.isDefault);
        if (explicit) return explicit;

        if (this.settings.channels.length === 1) {
            this.settings.channels[0].isDefault = true;
            await this.saveSettings();
            return this.settings.channels[0];
        }

        return undefined;
    }

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
            const link = await sendNoteToTelegram(this.app, file, channel, silent, attachUnderText);
            if (this.settings.savePostLinks && link) {
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                    if (!Array.isArray(fm.telegram_links)) fm.telegram_links = [];
                    fm.telegram_links.push(link);
                });
            }
            new Notice(t.NOTICE_SUCCESS);
        } catch (err: any) {
            new Notice(`${t.NOTICE_ERR_SEND}${err.message}`);
        }
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() {
        await this.saveData(this.settings);
        this.syncChannelCommands();
    }
}