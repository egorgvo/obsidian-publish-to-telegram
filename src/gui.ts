import { App, Modal, ButtonComponent, ToggleComponent, Notice, TFile, MarkdownRenderer, PluginSettingTab, Setting, TextComponent, DropdownComponent } from "obsidian";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";
import { t } from "../lang/helpers";
import type SendToTelegramPlugin from "../main";
import { fetchConfig, startAuth, verifyAuth, CloudConfig } from "./auth";
import { TelegramChannel, TelegramSecrets } from "./types";
import { createClient } from "./telegram";

// ─── Channel resolution helpers ───────────────────────────────────────────────

function findChannelByLink(channels: TelegramChannel[], link: string): TelegramChannel | null {
    const msgIdMatch = link.match(/\/(?:t\.me\/|c\/|)([^/]+)\/(\d+)\/?$/);
    if (!msgIdMatch) return null;
    const identifier = msgIdMatch[1];
    return channels.find(c => {
        const cleanChatId = c.chatId.replace(/^-100|^@/, "");
        return c.chatId === identifier ||
               c.chatId === `@${identifier}` ||
               cleanChatId === identifier;
    }) || null;
}

async function resolveChannelByLink(channels: TelegramChannel[], link: string, secrets?: TelegramSecrets): Promise<TelegramChannel | null> {
    const direct = findChannelByLink(channels, link);
    if (direct) return direct;

    const msgIdMatch = link.match(/\/(?:t\.me\/|c\/|)([^/]+)\/(\d+)\/?$/);
    if (!msgIdMatch || !secrets?.telegramSession) return null;
    const identifier = msgIdMatch[1].toLowerCase();

    const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
    try {
        for (const channel of channels) {
            if (!channel.chatId) continue;
            try {
                const entity = await client.getEntity(channel.chatId) as any;
                const username: string | undefined = entity?.username;
                if (username && username.toLowerCase() === identifier) return channel;
            } catch { continue; }
        }
    } finally {
        await client.destroy();
    }

    return null;
}

// ─── Formatting Help Modal ────────────────────────────────────────────────────

export class FormattingHelpModal extends Modal {

    private plugin: SendToTelegramPlugin;

    constructor(app: App, plugin: SendToTelegramPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(t.SETTING_FORMATTING_HELP);
        contentEl.addClass("telegram-formatting-help-modal");
        MarkdownRenderer.render(
            this.app,
            t.FORMATTING_HELP_CONTENT,
            contentEl,
            "",
            this.plugin
        );
    }

    onClose() { this.contentEl.empty(); }
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

export class ConfirmationModal extends Modal {
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

// ─── Multi Preset Modal ───────────────────────────────────────────────────────

export class MultiPresetModal extends Modal {
    plugin: SendToTelegramPlugin;
    selectedChannels: Set<string>;
    file: TFile;

    private silentToggle: ToggleComponent;
    private attachToggle: ToggleComponent;
    private scheduleInput: HTMLInputElement | null = null;
    private updateLinkDropdown: DropdownComponent | null = null;
    private updateChannelHintEl: HTMLElement | null = null;
    private updateNameDescEl: HTMLElement | null = null;
    private resolvedUpdateChannel: TelegramChannel | null = null;

    private channelRows: Array<{ id: string, container: HTMLElement, toggle: ToggleComponent }> = [];

    constructor(app: App, plugin: SendToTelegramPlugin, file: TFile) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.selectedChannels = new Set();
    }

    private setChannelRowsDisabled(disabled: boolean) {
        this.channelRows.forEach(row => {
            if (disabled) {
                row.container.addClass("is-disabled");
                row.toggle.setValue(false);
                this.selectedChannels.delete(row.id);
            } else {
                row.container.removeClass("is-disabled");
            }
        });
    }

    private setHint(text: string, isError: boolean) {
        if (!this.updateChannelHintEl) return;
        this.updateChannelHintEl.setText(text);
        this.updateChannelHintEl.show();
        this.updateNameDescEl?.hide();
        if (isError) this.updateChannelHintEl.addClass("is-error");
        else this.updateChannelHintEl.removeClass("is-error");
    }

    private hideHint() {
        this.updateChannelHintEl?.hide();
        this.updateNameDescEl?.show();
    }

    private async handleLinkSelection(value: string) {
        if (value === "none") {
            this.resolvedUpdateChannel = null;
            this.setChannelRowsDisabled(false);
            this.hideHint();
            return;
        }

        this.setChannelRowsDisabled(true);
        this.setHint(t.MULTI_PRESET_UPDATE_RESOLVING, false);

        const matched = await resolveChannelByLink(this.plugin.settings.channels, value, this.plugin.secrets);
        this.resolvedUpdateChannel = matched;

        if (matched) {
            this.setHint(t.MULTI_PRESET_UPDATE_WILL_USE.replace("{name}", matched.name || matched.chatId), false);
        } else {
            this.setHint(t.MULTI_PRESET_UPDATE_NO_MATCH, true);
        }
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
            nameEl.setText(channel.name || t.UNTITLED_CHANNEL);

            const controlEl = itemEl.createDiv("telegram-multi-preset-control");
            const toggle = new ToggleComponent(controlEl)
                .setValue(false)
                .onChange(value => {
                    if (value) this.selectedChannels.add(channel.id);
                    else this.selectedChannels.delete(channel.id);
                });

            this.channelRows.push({ id: channel.id, container: itemEl, toggle });
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

        const scheduleOptionEl = contentEl.createDiv("telegram-option-item");
        const scheduleTextEl = scheduleOptionEl.createDiv("telegram-option-text");
        scheduleTextEl.createDiv({ text: t.MULTI_PRESET_SCHEDULE_NAME, cls: "telegram-option-name" });
        scheduleTextEl.createDiv({ text: t.MULTI_PRESET_SCHEDULE_DESC, cls: "telegram-option-desc" });
        this.scheduleInput = scheduleOptionEl.createDiv("telegram-option-control").createEl("input", { cls: "telegram-schedule-input" });
        this.scheduleInput.type = "datetime-local";

        // ─── Update Existing Post Section ─────────────────────────────────────────────

        contentEl.createDiv({
            text: t.MULTI_PRESET_UPDATE_HEADING,
            cls: "telegram-modal-heading"
        });

        const updateOptionEl = contentEl.createDiv("telegram-option-item");
        const updateTextEl = updateOptionEl.createDiv("telegram-option-text");
        updateTextEl.createDiv({ text: t.MULTI_PRESET_UPDATE_NAME, cls: "telegram-option-name" });
        this.updateNameDescEl = updateTextEl.createDiv({ text: t.MULTI_PRESET_UPDATE_NAME_DESC, cls: "telegram-option-desc" });
        this.updateChannelHintEl = updateTextEl.createDiv({ cls: "telegram-update-channel-hint" });
        this.updateChannelHintEl.hide();

        const cache = this.app.metadataCache.getFileCache(this.file);
        let telegramLinks: string[] = [];

        if (cache?.frontmatter?.telegram_links) {
            const links = cache.frontmatter.telegram_links;
            telegramLinks = Array.isArray(links) ? links.map(String) : [String(links)];
        }

        if (telegramLinks.length > 0) {
            this.updateLinkDropdown = new DropdownComponent(updateOptionEl.createDiv("telegram-option-control"));
            this.updateLinkDropdown.addOption("none", t.MULTI_PRESET_UPDATE_NO_OPTION);

            telegramLinks.forEach((link, idx) => {
                this.updateLinkDropdown!.addOption(
                    link,
                    t.MULTI_PRESET_UPDATE_LINK_LABEL
                        .replace("{idx}", String(idx + 1))
                        .replace("{link}", link)
                );
            });
            this.updateLinkDropdown.setValue("none");

            this.updateLinkDropdown.onChange((value) => {
                this.handleLinkSelection(value);
            });
        } else {
            updateTextEl.createDiv({ text: t.MULTI_PRESET_UPDATE_NO_LINKS, cls: "telegram-option-desc" });
        }

        const btnContainer = contentEl.createDiv("telegram-modal-buttons");
        new ButtonComponent(btnContainer)
            .setButtonText(t.MULTI_PRESET_POST_BTN)
            .setCta()
            .onClick(async () => {
                const updateLinkRaw = this.updateLinkDropdown?.getValue();
                const isUpdating = updateLinkRaw && updateLinkRaw !== "none";

                if (!isUpdating && this.selectedChannels.size === 0) {
                    new Notice(t.MULTI_PRESET_NO_SELECTION);
                    return;
                }

                const silent = this.silentToggle?.getValue() ?? false;
                const attachUnderText = this.attachToggle?.getValue() ?? false;
                const updateLink = isUpdating ? updateLinkRaw : undefined;

                let scheduleDate: Date | undefined;
                if (this.scheduleInput?.value) {
                    scheduleDate = new Date(this.scheduleInput.value);
                }

                let channelsToPost: TelegramChannel[] = [];

                if (isUpdating) {
                    const targetChannel = this.resolvedUpdateChannel
                        ?? await resolveChannelByLink(this.plugin.settings.channels, updateLinkRaw!, this.plugin.secrets);

                    if (!targetChannel) {
                        new Notice(t.MULTI_PRESET_UPDATE_NO_MATCH_NOTICE);
                        return;
                    }
                    channelsToPost = [targetChannel];
                } else {
                    channelsToPost = this.plugin.settings.channels.filter(c => this.selectedChannels.has(c.id));
                }

                this.close();

                for (const channel of channelsToPost) {
                    await (this.plugin as any).sendNoteToTelegram(this.file, channel, silent, attachUnderText, updateLink, scheduleDate);
                }
            });
    }

    onClose() { this.contentEl.empty(); }
}

// ─── Auth Modal ──────────────────────────────────────────────────────────────

export class AuthModal extends Modal {
    private plugin: SendToTelegramPlugin;
    private phone = "";
    private userId = "";
    private config: CloudConfig | null = null;
    private onSuccess: () => void;

    constructor(app: App, plugin: SendToTelegramPlugin, onSuccess: () => void) {
        super(app);
        this.plugin = plugin;
        this.onSuccess = onSuccess;
        this.userId = crypto.randomUUID();
    }

    onOpen() { this.renderPhoneStep(); }
    onClose() { this.contentEl.empty(); }

    private renderPhoneStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        let phoneValue = "";
        new Setting(contentEl)
            .setName(t.AUTH_PHONE_NAME)
            .setDesc(t.AUTH_PHONE_DESC)
            .addText(text => text
                .setPlaceholder(t.AUTH_PHONE_PLACEHOLDER)
                .onChange(v => { phoneValue = v; }));

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_SEND_CODE_BTN)
            .setCta()
            .onClick(async () => {
                if (!phoneValue.trim()) return;
                this.phone = phoneValue.trim();
                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    this.config = await fetchConfig(
                        this.plugin.settings.configUrl,
                        this.plugin.manifest.version
                    );
                    await startAuth(
                        this.config.auth_start_url,
                        this.phone,
                        this.userId,
                        this.plugin.manifest.version
                    );
                    this.renderCodeStep();
                } catch (err: any) {
                    btn.setDisabled(false);
                    btn.setButtonText(t.AUTH_SEND_CODE_BTN);
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }));
    }

    private renderCodeStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        contentEl.createEl("p", { text: t.AUTH_CODE_SENT.replace("{phone}", this.phone) });

        let codeValue = "";
        new Setting(contentEl)
            .setName(t.AUTH_CODE_NAME)
            .addText(text => text
                .setPlaceholder(t.AUTH_CODE_PLACEHOLDER)
                .onChange(v => { codeValue = v; }));

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_VERIFY_BTN)
            .setCta()
            .onClick(async () => {
                if (!codeValue.trim()) return;
                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    const result = await verifyAuth(
                        this.config!.auth_verify_url,
                        this.userId,
                        this.plugin.manifest.version,
                        codeValue.trim()
                    );
                    if (result.session) {
                        await this.saveSession(result.session);
                    } else if (result.reason === "password_required") {
                        this.renderPasswordStep();
                    }
                } catch (err: any) {
                    btn.setDisabled(false);
                    btn.setButtonText(t.AUTH_VERIFY_BTN);
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }));
    }

    private renderPasswordStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        contentEl.createEl("p", { text: t.AUTH_PASSWORD_REQUIRED });

        let passwordValue = "";
        new Setting(contentEl)
            .setName(t.AUTH_PASSWORD_NAME)
            .addText(text => {
                text.setPlaceholder(t.AUTH_PASSWORD_PLACEHOLDER)
                    .onChange(v => { passwordValue = v; });
                text.inputEl.type = "password";
            });

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_VERIFY_BTN)
            .setCta()
            .onClick(async () => {
                if (!passwordValue.trim()) return;
                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    const result = await verifyAuth(
                        this.config!.auth_verify_url,
                        this.userId,
                        this.plugin.manifest.version,
                        undefined,
                        passwordValue.trim()
                    );
                    if (result.session) {
                        await this.saveSession(result.session);
                    }
                } catch (err: any) {
                    btn.setDisabled(false);
                    btn.setButtonText(t.AUTH_VERIFY_BTN);
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }));
    }

    private async saveSession(session: string) {
        this.plugin.secrets.telegramSession = session;
        await this.plugin.saveSecrets();
        this.plugin.settings.telegramDisplayName = this.phone;
        await this.plugin.saveSettings();
        new Notice(t.AUTH_SUCCESS);
        this.onSuccess();
        this.close();
    }
}

// ─── Local Auth Modal ─────────────────────────────────────────────────────

export class LocalAuthModal extends Modal {
    private plugin: SendToTelegramPlugin;
    private phone = "";
    private apiId = 0;
    private apiHash = "";
    private client: TelegramClient | null = null;
    private phoneCodeHash = "";
    private onSuccess: () => void;

    constructor(app: App, plugin: SendToTelegramPlugin, onSuccess: () => void) {
        super(app);
        this.plugin = plugin;
        this.onSuccess = onSuccess;
    }

    onOpen() { this.renderPhoneStep(); }

    onClose() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        this.contentEl.empty();
    }

    private renderPhoneStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        let phoneValue = "";
        let apiIdValue = "";
        let apiHashValue = "";

        new Setting(contentEl)
            .setName(t.AUTH_PHONE_NAME)
            .setDesc(t.AUTH_PHONE_DESC)
            .addText(text => text
                .setPlaceholder(t.AUTH_PHONE_PLACEHOLDER)
                .onChange(v => { phoneValue = v; }));

        new Setting(contentEl)
            .setName(t.AUTH_LOCAL_API_ID_NAME)
            .setDesc(t.AUTH_LOCAL_API_ID_DESC)
            .addText(text => text
                .setPlaceholder("12345")
                .onChange(v => { apiIdValue = v; }));

        new Setting(contentEl)
            .setName(t.AUTH_LOCAL_API_HASH_NAME)
            .setDesc(t.AUTH_LOCAL_API_HASH_DESC)
            .addText(text => text
                .setPlaceholder("0123456789abcdef...")
                .onChange(v => { apiHashValue = v; }));

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_SEND_CODE_BTN)
            .setCta()
            .onClick(async () => {
                if (!phoneValue.trim() || !apiIdValue.trim() || !apiHashValue.trim()) return;
                this.phone = phoneValue.trim();
                this.apiId = Number(apiIdValue.trim());
                this.apiHash = apiHashValue.trim();

                if (!this.apiId || isNaN(this.apiId)) {
                    new Notice(t.AUTH_LOCAL_INVALID_API_ID);
                    return;
                }

                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    this.client = new TelegramClient(
                        new StringSession(""),
                        this.apiId,
                        this.apiHash,
                        { connectionRetries: 3, useWSS: true }
                    );
                    await this.client.connect();
                    const result = await this.client.sendCode(
                        { apiId: this.apiId, apiHash: this.apiHash },
                        this.phone
                    );
                    this.phoneCodeHash = result.phoneCodeHash;
                    this.renderCodeStep();
                } catch (err: any) {
                    btn.setDisabled(false);
                    btn.setButtonText(t.AUTH_SEND_CODE_BTN);
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }));
    }

    private renderCodeStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        contentEl.createEl("p", { text: t.AUTH_CODE_SENT.replace("{phone}", this.phone) });

        let codeValue = "";
        new Setting(contentEl)
            .setName(t.AUTH_CODE_NAME)
            .addText(text => text
                .setPlaceholder(t.AUTH_CODE_PLACEHOLDER)
                .onChange(v => { codeValue = v; }));

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_VERIFY_BTN)
            .setCta()
            .onClick(async () => {
                if (!codeValue.trim() || !this.client) return;
                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    await this.client.invoke(
                        new Api.auth.SignIn({
                            phoneNumber: this.phone,
                            phoneCodeHash: this.phoneCodeHash,
                            phoneCode: codeValue.trim(),
                        })
                    );
                    await this.saveSession();
                } catch (err: any) {
                    if (err instanceof Error && err.message.includes("SESSION_PASSWORD_NEEDED")) {
                        this.renderPasswordStep();
                    } else {
                        btn.setDisabled(false);
                        btn.setButtonText(t.AUTH_VERIFY_BTN);
                        new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                    }
                }
            }));
    }

    private renderPasswordStep() {
        const { contentEl, titleEl } = this;
        contentEl.empty();
        titleEl.setText(t.AUTH_TITLE);

        contentEl.createEl("p", { text: t.AUTH_PASSWORD_REQUIRED });

        let passwordValue = "";
        new Setting(contentEl)
            .setName(t.AUTH_PASSWORD_NAME)
            .addText(text => {
                text.setPlaceholder(t.AUTH_PASSWORD_PLACEHOLDER)
                    .onChange(v => { passwordValue = v; });
                text.inputEl.type = "password";
            });

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn => btn
            .setButtonText(t.AUTH_VERIFY_BTN)
            .setCta()
            .onClick(async () => {
                if (!passwordValue.trim() || !this.client) return;
                btn.setDisabled(true);
                btn.setButtonText(t.AUTH_LOADING);
                try {
                    await this.client.signInWithPassword(
                        { apiId: this.apiId, apiHash: this.apiHash },
                        { password: () => passwordValue.trim() }
                    );
                    await this.saveSession();
                } catch (err: any) {
                    btn.setDisabled(false);
                    btn.setButtonText(t.AUTH_VERIFY_BTN);
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }));
    }

    private async saveSession() {
        if (!this.client) return;
        const session = this.client.session.save() as unknown as string;
        this.plugin.secrets.telegramSession = session;
        this.plugin.secrets.telegramApiId = this.apiId;
        this.plugin.secrets.telegramApiHash = this.apiHash;
        await this.plugin.saveSecrets();
        this.plugin.settings.telegramDisplayName = this.phone;
        await this.plugin.saveSettings();
        new Notice(t.AUTH_SUCCESS);
        this.onSuccess();
        this.close();
    }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

export class TelegramSettingTab extends PluginSettingTab {
    plugin: SendToTelegramPlugin;

    constructor(app: App, plugin: SendToTelegramPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl).setHeading().setName(t.SETTING_HEADER);

        containerEl.createEl("p", { text: t.SETTING_DESCRIPTION, cls: "telegram-plugin-description" });

        // ── Telegram Account Auth ──
        new Setting(containerEl).setHeading().setName(t.AUTH_SECTION_HEADER);

        new Setting(containerEl)
            .setName(t.AUTH_CONFIG_URL_NAME)
            .setDesc(t.AUTH_CONFIG_URL_DESC)
            .addText(text => text
                .setPlaceholder(t.AUTH_CONFIG_URL_PLACEHOLDER)
                .setValue(this.plugin.settings.configUrl)
                .onChange(async v => {
                    this.plugin.settings.configUrl = v;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.secrets.telegramSession) {
            new Setting(containerEl)
                .setName(t.AUTH_AUTHORIZED_AS.replace("{name}", this.plugin.settings.telegramDisplayName))
                .addButton(btn => btn
                    .setButtonText(t.AUTH_LOGOUT_BTN)
                    .setWarning()
                    .onClick(async () => {
                        await this.plugin.clearSecrets();
                        this.plugin.settings.telegramDisplayName = "";
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        } else {
            new Setting(containerEl)
                .setName(t.AUTH_NOT_AUTHORIZED)
                .addButton(btn => btn
                    .setButtonText(t.AUTH_AUTHORIZE_BTN)
                    .setCta()
                    .onClick(() => {
                        if (!this.plugin.settings.configUrl) {
                            new Notice(t.AUTH_NO_CONFIG_URL);
                            return;
                        }
                        new AuthModal(this.app, this.plugin, () => this.display()).open();
                    }))
                .addButton(btn => btn
                    .setButtonText(t.AUTH_LOCAL_BTN)
                    .onClick(() => {
                        new LocalAuthModal(this.app, this.plugin, () => this.display()).open();
                    }));
        }

        // ── Channels ──
        const addSection = containerEl.createDiv("telegram-add-preset-section");
        const infoDiv = addSection.createDiv("telegram-add-preset-info");
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_NAME, cls: "telegram-add-preset-title" });
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_DESC, cls: "telegram-add-preset-description" });

        const buttonContainer = addSection.createDiv("telegram-add-preset-button-container");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_FORMATTING_HELP)
            .onClick(() => { new FormattingHelpModal(this.app, this.plugin).open(); })
            .buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_ADD_CHANNEL)
            .onClick(async () => {
                this.plugin.settings.channels.unshift({ id: Date.now().toString(), name: "", chatId: "", isDefault: false });
                await this.plugin.saveSettings();
                this.display();
            }).buttonEl.addClass("telegram-add-button");

        new Setting(containerEl).setName(t.SETTING_SAVE_POST_LINKS_NAME).setDesc(t.SETTING_SAVE_POST_LINKS_DESC)
            .addToggle(toggle => toggle.setValue(this.plugin.settings.savePostLinks)
                .onChange(async (v) => { this.plugin.settings.savePostLinks = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl).setName(t.SETTING_MD_EMBEDS_AS_COMMENTS_NAME).setDesc(t.SETTING_MD_EMBEDS_AS_COMMENTS_DESC)
            .addToggle(toggle => toggle.setValue(this.plugin.settings.treatMdEmbedsAsComments)
                .onChange(async (v) => { this.plugin.settings.treatMdEmbedsAsComments = v; await this.plugin.saveSettings(); }));

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
                        if (e.key === "Enter") { e.preventDefault(); save(); }
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
