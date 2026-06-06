import { Plugin, Notice, TFile, TFolder, Menu } from "obsidian";
import { t } from "./lang/helpers";
import { TelegramChannel, TelegramSettings, TelegramSecrets, DEFAULT_SETTINGS } from "./src/types";
import { sendNoteToTelegram, checkIsForum, createClient } from "./src/telegram";
import { FormattingHelpModal, MultiPresetModal, TelegramSettingTab } from "./src/gui";
import { errMessage } from "./src/util";

export default class SendToTelegramPlugin extends Plugin {
    settings: TelegramSettings;
    secrets: TelegramSecrets = { telegramSession: "", telegramApiId: 0, telegramApiHash: "" };

    private channelCommandIds: string[] = [];
    private forumCache: Map<string, boolean> = new Map();

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new TelegramSettingTab(this.app, this));

        this.registerStaticCommands();

        this.syncChannelCommands();

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
                if (!(file instanceof TFile)) return;
                if (this.settings.channels.length === 0) return;

                menu.addSeparator();

                menu.addItem((item) => {
                    item.setTitle(t.MENU_TITLE).setIcon("paper-plane");
                    item.onClick(async () => {
                        const defaultChannel = await this.resolveDefaultChannel();
                        if (!defaultChannel) {
                            new MultiPresetModal(this.app, this, file).open();
                            return;
                        }
                        void this.sendNoteToTelegram(file, defaultChannel, false, false);
                    });
                });

                menu.addItem((item) => {
                    item.setTitle(t.COMMAND_SEND_MULTIPLE).setIcon("sliders-horizontal");
                    item.onClick(() => {
                        new MultiPresetModal(this.app, this, file).open();
                    });
                });

                menu.addSeparator();
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
                if (!defaultChannel) { new MultiPresetModal(this.app, this, file).open(); return; }
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
                new FormattingHelpModal(this.app).open();
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
        const commands = (this.app as unknown as { commands: { removeCommand(id: string): void } }).commands;
        this.channelCommandIds.forEach(id => commands.removeCommand(id));
        this.channelCommandIds = [];

        this.settings.channels.forEach(channel => {
            const commandId = `send-channel-${channel.id}`;
            this.addCommand({
                id: commandId,
                name: `${t.COMMAND_SEND_TO_PRESET} ${channel.name || t.CHANNEL_DEFAULT_NAME}`,
                callback: async () => {
                    const file = this.app.workspace.getActiveFile();
                    if (!file) return;
                    const isForum = await this.isChannelForum(channel);
                    if (isForum) {
                        new MultiPresetModal(this.app, this, file, channel.id).open();
                    } else {
                        await this.sendNoteToTelegram(file, channel, false, false);
                    }
                }
            });
            this.channelCommandIds.push(`${this.manifest.id}:${commandId}`);
        });
    }

    private async isChannelForum(channel: TelegramChannel): Promise<boolean> {
        if (this.forumCache.has(channel.id)) return this.forumCache.get(channel.id)!;
        if (!this.secrets.telegramSession) return false;
        try {
            const chatId = (channel.chatTargets?.[0]?.id ?? channel.chatId ?? "").trim();
            const entity = /^-?\d+$/.test(chatId) ? parseInt(chatId) : (chatId.startsWith("@") ? chatId : `@${chatId}`);
            const client = await createClient(this.secrets.telegramSession, this.secrets.telegramApiId, this.secrets.telegramApiHash);
            try {
                const result = await checkIsForum(client, entity);
                this.forumCache.set(channel.id, result);
                return result;
            } finally {
                await client.destroy();
            }
        } catch {
            return false;
        }
    }

    async sendNoteToTelegram(file: TFile, channel: TelegramChannel, silent: boolean, attachUnderText: boolean, updateLink?: string, scheduleDate?: Date): Promise<void> {
        if (!this.secrets.telegramSession) { new Notice(t.NOTICE_ERR_NOT_AUTHENTICATED); return; }

        const targets = channel.chatTargets?.length > 0
            ? channel.chatTargets
            : (channel.chatId ? [{ id: channel.chatId, title: channel.chatTitle }] : []);

        if (targets.length === 0) { new Notice(t.NOTICE_ERR_CONFIG); return; }

        const progressNotice = new Notice(t.NOTICE_PUBLISHING, 0);
        const allLinks: string[] = [];
        const allErrors: Error[] = [];

        try {
            for (const target of targets) {
                const singleChannel: TelegramChannel = { ...channel, chatId: target.id, chatTitle: target.title };
                const { links, errors } = await sendNoteToTelegram(
                    this.app, file, singleChannel, this.settings, this.secrets, silent, attachUnderText,
                    this.settings.treatMdEmbedsAsComments, updateLink, scheduleDate,
                    () => { progressNotice.setMessage(t.NOTICE_PUBLISHING_COMMENTS); }
                );
                allLinks.push(...links);
                allErrors.push(...errors);
            }

            progressNotice.hide();

            if (this.settings.savePostLinks && allLinks.length > 0 && !scheduleDate) {
                await this.app.fileManager.processFrontMatter(file, (fm: { telegram_links?: unknown }) => {
                    const links = Array.isArray(fm.telegram_links) ? fm.telegram_links as string[] : [];
                    for (const link of allLinks) {
                        if (!links.includes(link)) links.push(link);
                    }
                    fm.telegram_links = links;
                });
            }

            for (const err of allErrors) {
                const msg: string = (err.message ?? "").toUpperCase();
                if (msg.includes("MESSAGE_NOT_MODIFIED")) {
                    new Notice(t.NOTICE_ERR_NOT_MODIFIED);
                } else if (msg.includes("MESSAGE_TOO_LONG") || msg.includes("MESSAGE IS TOO LONG")) {
                    new Notice(t.NOTICE_ERR_TOO_LONG_TEXT);
                } else if (msg.includes("MEDIA_CAPTION_TOO_LONG") || msg.includes("CAPTION IS TOO LONG")) {
                    new Notice(t.NOTICE_ERR_TOO_LONG_CAPTION);
                } else {
                    new Notice(`${t.NOTICE_ERR_SEND}${err.message ?? ""}`);
                }
            }

            if (allErrors.length === 0) new Notice(scheduleDate ? t.NOTICE_SCHEDULED : t.NOTICE_SUCCESS);

        } catch (err) {
            progressNotice.hide();
            const msg: string = errMessage(err).toUpperCase();
            if (msg.includes("MESSAGE_NOT_MODIFIED")) {
                new Notice(t.NOTICE_ERR_NOT_MODIFIED);
            } else if (msg.includes("MESSAGE_TOO_LONG") || msg.includes("MESSAGE IS TOO LONG")) {
                new Notice(t.NOTICE_ERR_TOO_LONG_TEXT);
            } else if (msg.includes("MEDIA_CAPTION_TOO_LONG") || msg.includes("CAPTION IS TOO LONG")) {
                new Notice(t.NOTICE_ERR_TOO_LONG_CAPTION);
            } else {
                new Notice(`${t.NOTICE_ERR_SEND}${errMessage(err)}`);
            }
        }
    }

    async loadSettings() {
        const raw = (await this.loadData() ?? {}) as Partial<TelegramSettings> & {
            telegramSession?: string;
            telegramApiId?: number;
            telegramApiHash?: string;
        };
        this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
        // Migrate single chatId/chatTitle → chatTargets array
        let migrated = false;
        for (const ch of this.settings.channels) {
            if (!ch.chatTargets) {
                ch.chatTargets = ch.chatId ? [{ id: ch.chatId, title: ch.chatTitle }] : [];
                migrated = true;
            }
        }
        if (migrated) await this.saveData(this.settings);
        // Migrate secrets from data.json to SecretStorage — reuse raw, no second loadData()
        if (raw?.telegramSession) {
            this.app.secretStorage.setSecret("telegram-session", raw.telegramSession);
            this.app.secretStorage.setSecret("telegram-api-id", String(raw.telegramApiId || 0));
            this.app.secretStorage.setSecret("telegram-api-hash", raw.telegramApiHash || "");
            delete raw.telegramSession;
            delete raw.telegramApiId;
            delete raw.telegramApiHash;
            await this.saveData(raw);
        }
        await this.loadSecrets();
    }

    async loadSecrets() {
        const session = this.app.secretStorage.getSecret("telegram-session");
        const apiId = this.app.secretStorage.getSecret("telegram-api-id");
        const apiHash = this.app.secretStorage.getSecret("telegram-api-hash");
        this.secrets = {
            telegramSession: session ?? "",
            telegramApiId: Number(apiId ?? 0),
            telegramApiHash: apiHash ?? "",
        };
    }

    async saveSecrets() {
        this.app.secretStorage.setSecret("telegram-session", this.secrets.telegramSession);
        this.app.secretStorage.setSecret("telegram-api-id", String(this.secrets.telegramApiId));
        this.app.secretStorage.setSecret("telegram-api-hash", this.secrets.telegramApiHash);
    }

    async clearSecrets() {
        this.secrets = { telegramSession: "", telegramApiId: 0, telegramApiHash: "" };
        this.app.secretStorage.setSecret("telegram-session", "");
        this.app.secretStorage.setSecret("telegram-api-id", "0");
        this.app.secretStorage.setSecret("telegram-api-hash", "");
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.syncChannelCommands();
    }
}
