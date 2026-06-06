import { App, Modal, ButtonComponent, ToggleComponent, Notice, TFile, MarkdownRenderer, PluginSettingTab, Setting, TextComponent, DropdownComponent, setIcon, AbstractInputSuggest } from "obsidian";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";
import { t } from "../lang/helpers";
import type SendToTelegramPlugin from "../main";
import QRCode from "qrcode";
import { TelegramChannel, TelegramSecrets } from "./types";
import { createClient, ForumTopicData, checkIsForum, getForumTopics, getUserDialogs, DialogData, DEFAULT_TG_API_ID, DEFAULT_TG_API_HASH, AUTH_API_ID, AUTH_API_HASH } from "./telegram";

// ─── Channel resolution helpers ───────────────────────────────────────────────

function findChannelByLink(channels: TelegramChannel[], link: string): TelegramChannel | null {
    // Handles both 2-segment and 3-segment (forum topic) links
    const match = link.match(/t\.me\/(?:c\/)?([^/]+)\/\d+(?:\/\d+)?\/?$/);
    if (!match) return null;
    const identifier = match[1];
    return channels.find(c => {
        const targets = c.chatTargets?.length > 0 ? c.chatTargets : (c.chatId ? [{ id: c.chatId }] : []);
        return targets.some(t => {
            const clean = t.id.replace(/^-100|^@/, "");
            return t.id === identifier || t.id === `@${identifier}` || clean === identifier;
        });
    }) || null;
}

async function resolveChannelByLink(channels: TelegramChannel[], link: string, secrets?: TelegramSecrets): Promise<TelegramChannel | null> {
    const direct = findChannelByLink(channels, link);
    if (direct) return direct;

    const match = link.match(/t\.me\/(?:c\/)?([^/]+)\/\d+(?:\/\d+)?\/?$/);
    if (!match || !secrets?.telegramSession) return null;
    const identifier = match[1].toLowerCase();

    const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
    try {
        for (const channel of channels) {
            const targets = channel.chatTargets?.length > 0 ? channel.chatTargets : (channel.chatId ? [{ id: channel.chatId }] : []);
            if (targets.length === 0) continue;
            try {
                for (const target of targets) {
                    const entity = await client.getEntity(target.id) as any;
                    const username: string | undefined = entity?.username;
                    if (username && username.toLowerCase() === identifier) return channel;
                }
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
    title: string;
    message: string;
    confirmText: string;

    constructor(app: App, title: string, message: string, confirmText: string, onSubmit: () => void) {
        super(app);
        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(this.title);
        contentEl.createEl("p", { text: this.message });
        const btnContainer = contentEl.createDiv("telegram-modal-buttons");
        new ButtonComponent(btnContainer).setButtonText(t.CONFIRM_CANCEL_BTN).onClick(() => this.close());
        new ButtonComponent(btnContainer).setButtonText(this.confirmText).setWarning().onClick(() => {
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
    private initialChannelId?: string;

    private silentToggle: ToggleComponent;
    private attachToggle: ToggleComponent;
    private scheduleInput: HTMLInputElement | null = null;
    private updateLinkDropdown: DropdownComponent | null = null;
    private updateChannelHintEl: HTMLElement | null = null;
    private updateNameDescEl: HTMLElement | null = null;
    private resolvedUpdateChannel: TelegramChannel | null = null;

    private channelRows: Array<{ id: string, container: HTMLElement, toggle: ToggleComponent, topicSection: HTMLElement }> = [];
    private clientReady: Promise<TelegramClient | null> = Promise.resolve(null);
    private selectedTopics: Map<string, Set<number>> = new Map();
    private forumTopicsCache: Map<string, ForumTopicData[]> = new Map();

    constructor(app: App, plugin: SendToTelegramPlugin, file: TFile, initialChannelId?: string) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.selectedChannels = new Set();
        this.initialChannelId = initialChannelId;
    }

    private setChannelRowsDisabled(disabled: boolean) {
        this.channelRows.forEach(row => {
            if (disabled) {
                row.container.addClass("is-disabled");
                row.container.removeClass("has-topics");
                row.toggle.setValue(false);
                this.selectedChannels.delete(row.id);
                this.selectedTopics.delete(row.id);
                row.topicSection.hide();
                row.topicSection.empty();
            } else {
                row.container.removeClass("is-disabled");
            }
        });
    }

    private async handleForumExpansion(channel: TelegramChannel, itemEl: HTMLElement, topicSection: HTMLElement): Promise<void> {
        topicSection.empty();
        topicSection.show();
        topicSection.createDiv({ text: t.MULTI_PRESET_TOPICS_LOADING, cls: "telegram-topic-loading" });

        const client = await this.clientReady;

        if (!this.selectedChannels.has(channel.id)) return;

        if (!client) {
            topicSection.hide();
            return;
        }

        let topics = this.forumTopicsCache.get(channel.id);
        if (!topics) {
            const chatId = channel.chatId.trim();
            const entity = /^-?\d+$/.test(chatId) ? parseInt(chatId) : (chatId.startsWith("@") ? chatId : `@${chatId}`);

            const isForum = await checkIsForum(client, entity);
            if (!this.selectedChannels.has(channel.id)) return;

            if (!isForum) {
                topicSection.hide();
                return;
            }

            topics = await getForumTopics(client, entity);
            if (!this.selectedChannels.has(channel.id)) return;

            this.forumTopicsCache.set(channel.id, topics);
        }

        if (!topics || topics.length === 0) {
            topicSection.hide();
            return;
        }

        topicSection.empty();
        itemEl.addClass("has-topics");
        topicSection.createDiv({ text: t.MULTI_PRESET_TOPICS_HEADING, cls: "telegram-topic-heading" });

        const topicSet = this.selectedTopics.get(channel.id) ?? new Set<number>();
        this.selectedTopics.set(channel.id, topicSet);

        for (const topic of topics) {
            const topicEl = topicSection.createDiv("telegram-topic-item");
            topicEl.createDiv({ text: topic.title, cls: "telegram-topic-name" });
            new ToggleComponent(topicEl.createDiv())
                .setValue(topicSet.has(topic.id))
                .onChange(value => {
                    if (value) topicSet.add(topic.id);
                    else topicSet.delete(topic.id);
                });
        }
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

        if (this.plugin.secrets.telegramSession) {
            this.clientReady = createClient(
                this.plugin.secrets.telegramSession,
                this.plugin.secrets.telegramApiId,
                this.plugin.secrets.telegramApiHash
            ).catch(() => null);
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

            const topicSection = listContainer.createDiv("telegram-topic-section");
            topicSection.hide();

            const isPreToggled = this.initialChannelId === channel.id;
            if (isPreToggled) this.selectedChannels.add(channel.id);

            const controlEl = itemEl.createDiv("telegram-multi-preset-control");
            const toggle = new ToggleComponent(controlEl)
                .setValue(isPreToggled)
                .onChange(async value => {
                    if (value) {
                        this.selectedChannels.add(channel.id);
                        await this.handleForumExpansion(channel, itemEl, topicSection);
                    } else {
                        this.selectedChannels.delete(channel.id);
                        this.selectedTopics.delete(channel.id);
                        itemEl.removeClass("has-topics");
                        topicSection.hide();
                        topicSection.empty();
                    }
                });

            if (isPreToggled) {
                this.handleForumExpansion(channel, itemEl, topicSection);
            }

            this.channelRows.push({ id: channel.id, container: itemEl, toggle, topicSection });
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

                interface PostTarget { channel: TelegramChannel; topicId?: number; }
                const postsToSend: PostTarget[] = [];

                if (isUpdating) {
                    const targetChannel = this.resolvedUpdateChannel
                        ?? await resolveChannelByLink(this.plugin.settings.channels, updateLinkRaw!, this.plugin.secrets);

                    if (!targetChannel) {
                        new Notice(t.MULTI_PRESET_UPDATE_NO_MATCH_NOTICE);
                        return;
                    }
                    postsToSend.push({ channel: targetChannel });
                } else {
                    for (const channelId of this.selectedChannels) {
                        const channel = this.plugin.settings.channels.find(c => c.id === channelId);
                        if (!channel) continue;
                        const topics = this.forumTopicsCache.get(channelId);
                        const topicIds = this.selectedTopics.get(channelId);
                        if (topics && topics.length > 0) {
                            if (!topicIds || topicIds.size === 0) {
                                postsToSend.push({ channel, topicId: 1 });
                            } else {
                                for (const topicId of topicIds) {
                                    postsToSend.push({ channel, topicId });
                                }
                            }
                        } else {
                            postsToSend.push({ channel });
                        }
                    }
                }

                this.close();

                for (const { channel, topicId } of postsToSend) {
                    const target: TelegramChannel = topicId ? { ...channel, topicId } : channel;
                    await (this.plugin as any).sendNoteToTelegram(this.file, target, silent, attachUnderText, updateLink, scheduleDate);
                }
            });
    }

    onClose() {
        this.clientReady.then(client => client?.destroy().catch(() => {}));
        this.contentEl.empty();
    }
}

// ─── Chat suggest ─────────────────────────────────────────────────────────────

class ChatSuggest extends AbstractInputSuggest<DialogData> {
    private loader: () => Promise<DialogData[]>;
    onPick: (dialog: DialogData) => Promise<void> = async () => {};

    constructor(app: App, inputEl: HTMLInputElement, loader: () => Promise<DialogData[]>) {
        super(app, inputEl);
        this.limit = 300;
        this.loader = loader;
    }

    async getSuggestions(query: string): Promise<DialogData[]> {
        const dialogs = await this.loader();
        const q = query.toLowerCase();
        return q
            ? dialogs.filter(d => d.title.toLowerCase().includes(q))
            : dialogs;
    }

    renderSuggestion(dialog: DialogData, el: HTMLElement): void { el.setText(dialog.title); }

    selectSuggestion(dialog: DialogData, _evt: MouseEvent | KeyboardEvent): void {
        this.onPick(dialog);
        this.setValue("");
        this.close();
    }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

export class TelegramSettingTab extends PluginSettingTab {
    plugin: SendToTelegramPlugin;
    private inlineQrClient: TelegramClient | null = null;
    private inlineLocalClient: TelegramClient | null = null;
    private dialogsFetch: Promise<DialogData[]> | null = null;
    private dialogsLoading = false;

    constructor(app: App, plugin: SendToTelegramPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        if (this.inlineQrClient) {
            this.inlineQrClient.disconnect().catch(() => {});
            this.inlineQrClient = null;
        }
        if (this.inlineLocalClient) {
            this.inlineLocalClient.disconnect().catch(() => {});
            this.inlineLocalClient = null;
        }
        const { containerEl } = this;
        containerEl.empty();

        if (this.plugin.secrets.telegramSession) {
            if (!this.dialogsFetch) this.dialogsFetch = this.fetchDialogs();
        } else {
            this.dialogsFetch = null;
            this.dialogsLoading = false;
        }

        new Setting(containerEl).setHeading().setName(t.SETTING_HEADER);

        containerEl.createEl("p", { text: t.SETTING_DESCRIPTION, cls: "telegram-plugin-description" });

        // ── General ──
        new Setting(containerEl).setHeading().setName(t.SECTION_GENERAL);

        if (this.plugin.secrets.telegramSession) {
            const authStatusEl = containerEl.createDiv({ cls: "telegram-auth-status" });
            authStatusEl.createSpan({
                text: t.AUTH_AUTHORIZED_AS.replace("{name}", this.plugin.settings.telegramDisplayName),
                cls: "telegram-auth-status-name"
            });
            const logoutBtn = authStatusEl.createEl("button", {
                cls: "clickable-icon telegram-logout-button",
                attr: { "aria-label": t.AUTH_LOGOUT_BTN }
            });
            setIcon(logoutBtn, "log-out");
            logoutBtn.addEventListener("click", () => {
                new ConfirmationModal(
                    this.app,
                    t.CONFIRM_LOGOUT_TITLE,
                    t.CONFIRM_LOGOUT_MSG,
                    t.CONFIRM_LOGOUT_BTN,
                    async () => {
                        await this.plugin.clearSecrets();
                        this.plugin.settings.telegramDisplayName = "";
                        await this.plugin.saveSettings();
                        this.display();
                    }
                ).open();
            });
        } else {
            const authContainer = containerEl.createDiv({ cls: "telegram-auth-inline" });
            this.renderInlinePhoneStep(authContainer);
        }

        new Setting(containerEl).setName(t.SETTING_SAVE_POST_LINKS_NAME).setDesc(t.SETTING_SAVE_POST_LINKS_DESC)
            .addToggle(toggle => toggle.setValue(this.plugin.settings.savePostLinks)
                .onChange(async (v) => { this.plugin.settings.savePostLinks = v; await this.plugin.saveSettings(); }))
            .settingEl.addClass("telegram-bordered-setting");

        new Setting(containerEl).setName(t.SETTING_MD_EMBEDS_AS_COMMENTS_NAME).setDesc(t.SETTING_MD_EMBEDS_AS_COMMENTS_DESC)
            .addToggle(toggle => toggle.setValue(this.plugin.settings.treatMdEmbedsAsComments)
                .onChange(async (v) => { this.plugin.settings.treatMdEmbedsAsComments = v; await this.plugin.saveSettings(); }))
            .settingEl.addClass("telegram-bordered-setting");

        // ── Presets ──
        new Setting(containerEl).setHeading().setName(t.SECTION_PRESETS);

        const addSection = containerEl.createDiv("telegram-add-preset-section");
        const infoDiv = addSection.createDiv("telegram-add-preset-info");
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_NAME, cls: "telegram-add-preset-title" });
        infoDiv.createEl("div", { text: t.SETTING_ADD_CHANNEL_DESC, cls: "telegram-add-preset-description" });

        const buttonContainer = addSection.createDiv("telegram-add-preset-button-container");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_OPEN_USERINFOBOT)
            .onClick(() => { window.open("https://t.me/userinfobot", "_blank"); })
            .buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_FORMATTING_HELP)
            .onClick(() => { new FormattingHelpModal(this.app, this.plugin).open(); })
            .buttonEl.addClass("telegram-link-button");

        new ButtonComponent(buttonContainer)
            .setButtonText(t.SETTING_ADD_CHANNEL)
            .onClick(async () => {
                this.plugin.settings.channels.unshift({ id: Date.now().toString(), name: "", chatTargets: [], chatId: "", isDefault: false });
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
                        if (e.key === "Enter") { e.preventDefault(); save(); }
                    });
                    input.inputEl.addEventListener("blur", save);
                }).buttonEl.addClass("telegram-edit-button");

            new ButtonComponent(header.createDiv("telegram-delete-container"))
                .setIcon("trash").onClick(async () => {
                    new ConfirmationModal(
                        this.app,
                        t.CONFIRM_DELETE_TITLE,
                        t.CONFIRM_DELETE_MSG.replace("{name}", channel.name || t.UNTITLED_CHANNEL),
                        t.CONFIRM_DELETE_BTN,
                        async () => {
                            this.plugin.settings.channels.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    ).open();
                }).buttonEl.addClass("telegram-delete-button");

            this.renderChatPicker(channelDiv, channel);

            new Setting(channelDiv).setName(t.SETTING_DEFAULT_CHANNEL).setDesc(t.SETTING_DEFAULT_DESC)
                .addToggle(toggle => toggle.setValue(channel.isDefault || false)
                    .onChange(async (v) => {
                        if (v) this.plugin.settings.channels.forEach(c => c.isDefault = false);
                        channel.isDefault = v;
                        await this.plugin.saveSettings();
                        this.display();
                    }))
                .settingEl.addClass("telegram-preset-default");
        });
    }

    private renderChatPicker(container: HTMLElement, channel: TelegramChannel): void {
        const pickerEl = container.createDiv("telegram-chat-picker");
        const fieldEl = pickerEl.createDiv("telegram-chat-picker-field");
        let activeSuggest: ChatSuggest | null = null;

        const renderField = () => {
            activeSuggest?.close();
            activeSuggest = null;
            fieldEl.empty();

            // Chips for each target
            for (const target of (channel.chatTargets ?? [])) {
                const chip = fieldEl.createEl("span", { cls: "telegram-chat-chip" });
                chip.createSpan({ text: target.title || target.id, cls: "telegram-chat-chip-text" });
                const removeBtn = chip.createEl("button", { cls: "telegram-chat-chip-remove" });
                setIcon(removeBtn, "x");
                removeBtn.addEventListener("click", async (e: MouseEvent) => {
                    e.stopPropagation();
                    channel.chatTargets = (channel.chatTargets ?? []).filter(t => t.id !== target.id);
                    channel.chatId = channel.chatTargets[0]?.id ?? "";
                    channel.chatTitle = channel.chatTargets[0]?.title;
                    await this.plugin.saveSettings();
                    renderField();
                });
            }

            // Always-visible input at the end
            const input = fieldEl.createEl("input", { cls: "telegram-chat-search" });
            input.type = "text";
            const hasChips = (channel.chatTargets?.length ?? 0) > 0;
            input.placeholder = hasChips ? "" : (
                !this.plugin.secrets.telegramSession ? t.SETTING_PLACEHOLDER_CHAT :
                this.dialogsLoading ? t.SETTING_CHAT_PICKER_LOADING :
                t.SETTING_PLACEHOLDER_CHAT_SEARCH
            );

            if (this.plugin.secrets.telegramSession) {
                const suggest = new ChatSuggest(this.app, input, () =>
                    this.dialogsFetch ?? Promise.resolve([])
                );
                activeSuggest = suggest;
                input.addEventListener("focus", () => {
                    if (this.dialogsLoading) {
                        // Wait for data before opening — avoids showing an empty dropdown
                        this.dialogsFetch?.then(() => {
                            if (document.activeElement === input) suggest.open();
                        });
                    } else {
                        suggest.open();
                    }
                });
                suggest.onPick = async (dialog: DialogData) => {
                    const isDupe = (channel.chatTargets ?? []).some(
                        t => t.id === dialog.id && t.topicId === dialog.topicId
                    );
                    if (!isDupe) {
                        if (!channel.chatTargets) channel.chatTargets = [];
                        channel.chatTargets.push({ id: dialog.id, title: dialog.title, topicId: dialog.topicId });
                        channel.chatId = channel.chatTargets[0]?.id ?? "";
                        channel.chatTitle = channel.chatTargets[0]?.title;
                        channel.topicId = channel.chatTargets[0]?.topicId;
                        await this.plugin.saveSettings();
                    }
                    renderField();
                };
                // Registered after the suggest's own keydown listener so it fires second.
                // If the suggest selected an item it already called setValue(""), so input.value
                // is empty by the time this runs — that's the signal to skip.
                input.addEventListener("keydown", async (e: KeyboardEvent) => {
                    if (e.key !== "Enter") return;
                    const id = input.value.trim();
                    if (!id) return;
                    e.preventDefault();
                    if ((channel.chatTargets ?? []).some(t => t.id === id)) { renderField(); return; }
                    if (!channel.chatTargets) channel.chatTargets = [];
                    channel.chatTargets.push({ id });
                    channel.chatId = channel.chatTargets[0]?.id ?? "";
                    channel.chatTitle = channel.chatTargets[0]?.title;
                    await this.plugin.saveSettings();
                    renderField();
                });
            } else {
                // No auth: Enter key adds a manual chat ID chip
                input.addEventListener("keydown", async (e: KeyboardEvent) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const id = input.value.trim();
                    if (!id || (channel.chatTargets ?? []).some(t => t.id === id)) return;
                    if (!channel.chatTargets) channel.chatTargets = [];
                    channel.chatTargets.push({ id });
                    channel.chatId = channel.chatTargets[0]?.id ?? "";
                    await this.plugin.saveSettings();
                    renderField();
                    fieldEl.querySelector<HTMLInputElement>(".telegram-chat-search")?.focus();
                });
            }
        };

        // Clicking the field background focuses the input
        fieldEl.addEventListener("click", (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest(".telegram-chat-chip-remove")) {
                fieldEl.querySelector<HTMLInputElement>(".telegram-chat-search")?.focus();
            }
        });

        renderField();
    }

    private fetchDialogs(): Promise<DialogData[]> {
        this.dialogsLoading = true;
        return (async () => {
            const client = await createClient(
                this.plugin.secrets.telegramSession,
                this.plugin.secrets.telegramApiId,
                this.plugin.secrets.telegramApiHash
            ).catch(() => null);
            const dialogs = client ? await getUserDialogs(client) : [];
            await client?.destroy().catch(() => {});
            this.dialogsLoading = false;
            this.containerEl.querySelectorAll<HTMLInputElement>('.telegram-chat-search').forEach(input => {
                if (input.placeholder === t.SETTING_CHAT_PICKER_LOADING) {
                    input.placeholder = t.SETTING_PLACEHOLDER_CHAT_SEARCH;
                }
            });
            return dialogs;
        })();
    }

    private buildAuthCard(
        container: HTMLElement,
        title: string,
        onBack?: () => void
    ): { fields: HTMLElement; submitEl: HTMLButtonElement; noteEl: HTMLParagraphElement; extraEl: HTMLElement } {
        container.empty();
        const card = container.createDiv({ cls: "telegram-auth-card" });

        const header = card.createDiv({ cls: "telegram-auth-header" });
        const backBtn = header.createEl("button", { cls: "telegram-auth-back" });
        setIcon(backBtn, "arrow-left");
        if (onBack) {
            backBtn.addEventListener("click", onBack);
        } else {
            backBtn.addClass("is-hidden");
        }
        header.createDiv({ text: title, cls: "telegram-auth-title" });
        header.createDiv();

        const fields = card.createDiv({ cls: "telegram-auth-fields" });
        const submitEl = card.createEl("button", { cls: "telegram-auth-submit" });
        const noteEl = card.createEl("p", { cls: "telegram-auth-note" });
        const extraEl = card.createDiv();

        return { fields, submitEl, noteEl, extraEl };
    }

    // Primary auth entry point: phone number + code, using bundled API credentials.
    private renderInlinePhoneStep(container: HTMLElement): void {
        const { fields, submitEl, noteEl, extraEl } = this.buildAuthCard(container, t.AUTH_STEP_1);

        let phoneValue = "";
        const phoneInput = fields.createEl("input", { cls: "telegram-auth-input", attr: { type: "tel", placeholder: t.AUTH_PHONE_PLACEHOLDER } });
        phoneInput.addEventListener("input", () => { phoneValue = phoneInput.value; });
        phoneInput.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submitEl.click(); } });
        setTimeout(() => phoneInput.focus(), 50);

        submitEl.textContent = t.AUTH_SEND_CODE_BTN;
        submitEl.addEventListener("click", async () => {
            if (!phoneValue.trim()) return;
            submitEl.disabled = true;
            submitEl.textContent = t.AUTH_LOADING;
            try {
                if (this.inlineLocalClient) {
                    await this.inlineLocalClient.disconnect();
                    this.inlineLocalClient = null;
                }
                this.inlineLocalClient = new TelegramClient(new StringSession(""), AUTH_API_ID, AUTH_API_HASH, { connectionRetries: 3, useWSS: true });
                await this.inlineLocalClient.connect();
                const result = await this.inlineLocalClient.sendCode({ apiId: AUTH_API_ID, apiHash: AUTH_API_HASH }, phoneValue.trim());
                this.renderInlineLocalCodeStep(container, { phone: phoneValue.trim(), apiId: AUTH_API_ID, apiHash: AUTH_API_HASH, phoneCodeHash: result.phoneCodeHash });
            } catch (err: any) {
                submitEl.disabled = false;
                submitEl.textContent = t.AUTH_SEND_CODE_BTN;
                new Notice(`${t.AUTH_ERROR}: ${err.message}`);
            }
        });

        noteEl.textContent = t.AUTH_PHONE_NOTE;

        const qrBtn = extraEl.createEl("button", { cls: "telegram-auth-link-btn", text: t.AUTH_PHONE_USE_QR });
        qrBtn.addEventListener("click", () => this.renderInlineQrStep(container));
    }

    private renderInlineQrStep(container: HTMLElement): void {
        if (this.inlineQrClient) {
            this.inlineQrClient.disconnect().catch(() => {});
            this.inlineQrClient = null;
        }

        const { fields, submitEl, noteEl, extraEl } = this.buildAuthCard(container, t.AUTH_QR_TITLE,
            () => this.renderInlinePhoneStep(container));
        submitEl.style.display = "none";

        const qrWrap = fields.createDiv({ cls: "telegram-qr-wrap" });
        qrWrap.createSpan({ text: t.AUTH_LOADING, cls: "telegram-qr-loading" });

        noteEl.textContent = t.AUTH_QR_NOTE;

        const linkBtn = extraEl.createEl("button", { cls: "telegram-auth-link-btn", text: t.AUTH_QR_USE_PHONE });
        linkBtn.addEventListener("click", () => {
            if (this.inlineQrClient) {
                this.inlineQrClient.disconnect().catch(() => {});
                this.inlineQrClient = null;
            }
            this.renderInlinePhoneStep(container);
        });

        const client = new TelegramClient(new StringSession(""), AUTH_API_ID, AUTH_API_HASH, { connectionRetries: 5, useWSS: true });
        client.setLogLevel("none" as any);
        this.inlineQrClient = client;

        // Renders a QR code SVG into qrWrap and updates the deep link.
        const showQr = async (token: Buffer): Promise<void> => {
            const tokenB64 = token.toString("base64")
                .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
            const url = `tg://login?token=${tokenB64}`;
            const svgStr = await QRCode.toString(url, { type: "svg", margin: 1 });
            qrWrap.empty();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgStr, "image/svg+xml");
            qrWrap.appendChild(svgDoc.documentElement);
        };

        // Manual polling loop — replaces signInUserWithQrCode.
        //
        // Rationale: after the user scans, the Telegram server sends UpdateLoginToken
        // and simultaneously closes the unauthenticated connection. GramJS's built-in
        // helper races these two events and then tries to invoke ExportLoginToken on
        // the now-closed socket, producing "Cannot send requests while disconnected".
        // Polling detects the scan on the next tick and reconnects before the invoke.
        const doAuth = async (): Promise<void> => {
            const POLL_MS = 3000;
            const TOKEN_TTL_MS = 27000; // tokens last 30 s; refresh 3 s early

            while (this.inlineQrClient) {
                // Ensure we have a live connection before invoking.
                if (!client.connected) {
                    try { await client.connect(); } catch {
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                }

                // Fetch/refresh the login token.
                let token: Buffer | null = null;
                try {
                    const res = await client.invoke(new Api.auth.ExportLoginToken({
                        apiId: AUTH_API_ID,
                        apiHash: AUTH_API_HASH,
                        exceptIds: [],
                    }));
                    if (res instanceof Api.auth.LoginToken) {
                        token = res.token;
                    } else if (res instanceof Api.auth.LoginTokenSuccess) {
                        return; // scan confirmed, no 2FA
                    } else if (res instanceof Api.auth.LoginTokenMigrateTo) {
                        await (client as any)._switchDC(res.dcId);
                        if (!client.connected) await client.connect();
                        await client.invoke(new Api.auth.ImportLoginToken({ token: res.token }));
                        return; // done after DC migration
                    }
                } catch (err: any) {
                    if (!this.inlineQrClient) return;
                    if ((err.errorMessage ?? err.message ?? "") === "SESSION_PASSWORD_NEEDED") throw err;
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }

                if (token) await showQr(token);

                // Poll until the current token expires, checking for a successful scan.
                const expiresAt = Date.now() + TOKEN_TTL_MS;
                let dropped = false;
                while (this.inlineQrClient && Date.now() < expiresAt) {
                    await new Promise(r => setTimeout(r, POLL_MS));
                    if (!this.inlineQrClient) return;
                    try {
                        if (!client.connected) await client.connect();
                        const poll = await client.invoke(new Api.auth.ExportLoginToken({
                            apiId: DEFAULT_TG_API_ID,
                            apiHash: DEFAULT_TG_API_HASH,
                            exceptIds: [],
                        }));
                        if (poll instanceof Api.auth.LoginTokenSuccess) return;
                        if (poll instanceof Api.auth.LoginTokenMigrateTo) {
                            await (client as any)._switchDC(poll.dcId);
                            if (!client.connected) await client.connect();
                            await client.invoke(new Api.auth.ImportLoginToken({ token: poll.token }));
                            return;
                        }
                        // Still LoginToken — user hasn't scanned yet, keep polling.
                    } catch (err: any) {
                        if (!this.inlineQrClient) return;
                        if ((err.errorMessage ?? err.message ?? "") === "SESSION_PASSWORD_NEEDED") throw err;
                        dropped = true;
                        break; // connection dropped; outer loop will reconnect
                    }
                }
                if (dropped) continue;
                // Token expired — outer loop fetches a fresh one.
            }
        };

        client.connect()
            .then(() => doAuth())
            .then(async () => {
                if (this.inlineQrClient) await this.saveInlineQrSession(client);
            })
            .catch(async (err: any) => {
                if (!this.inlineQrClient) return;
                if ((err.errorMessage ?? err.message ?? "") === "SESSION_PASSWORD_NEEDED") {
                    this.renderInlineQrPasswordStep(container, client, async () => {
                        if (this.inlineQrClient) await this.saveInlineQrSession(client);
                    });
                } else {
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            });
    }

    private renderInlineQrPasswordStep(
        container: HTMLElement,
        client: TelegramClient,
        onSuccess: () => void,
    ): void {
        const { fields, submitEl, noteEl } = this.buildAuthCard(container, t.AUTH_STEP_2);

        let passwordValue = "";
        const passwordInput = fields.createEl("input", { cls: "telegram-auth-input", attr: { type: "password", placeholder: t.AUTH_PASSWORD_PLACEHOLDER } });
        passwordInput.addEventListener("input", () => { passwordValue = passwordInput.value; });
        passwordInput.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submitEl.click(); } });
        setTimeout(() => passwordInput.focus(), 50);

        submitEl.textContent = t.AUTH_VERIFY_BTN;
        submitEl.addEventListener("click", async () => {
            if (!passwordValue.trim()) return;
            submitEl.disabled = true;
            submitEl.textContent = t.AUTH_LOADING;
            try {
                await client.signInWithPassword(
                    { apiId: AUTH_API_ID, apiHash: AUTH_API_HASH },
                    { password: async () => passwordValue.trim(), onError: async () => true }
                );
                onSuccess();
            } catch (err: any) {
                submitEl.disabled = false;
                submitEl.textContent = t.AUTH_VERIFY_BTN;
                new Notice(`${t.AUTH_ERROR}: ${err.message}`);
            }
        });

        noteEl.textContent = t.AUTH_PASSWORD_REQUIRED;
    }

    private async saveInlineQrSession(client: TelegramClient): Promise<void> {
        const session = client.session.save() as unknown as string;
        this.plugin.secrets.telegramSession = session;
        this.plugin.secrets.telegramApiId = 0;
        this.plugin.secrets.telegramApiHash = "";
        await this.plugin.saveSecrets();
        try {
            const me = await client.getMe() as any;
            const parts = [me.firstName, me.lastName].filter(Boolean).join(" ");
            const username = me.username ? ` (@${me.username})` : "";
            this.plugin.settings.telegramDisplayName = `${parts}${username}`;
        } catch {
            this.plugin.settings.telegramDisplayName = "";
        }
        await client.disconnect();
        this.inlineQrClient = null;
        await this.plugin.saveSettings();
        new Notice(t.AUTH_SUCCESS);
        this.display();
    }

    private renderInlineLocalCodeStep(
        container: HTMLElement,
        state: { phone: string; apiId: number; apiHash: string; phoneCodeHash: string }
    ): void {
        const { fields, submitEl, noteEl } = this.buildAuthCard(
            container, t.AUTH_STEP_2,
            () => {
                if (this.inlineLocalClient) {
                    this.inlineLocalClient.disconnect().catch(() => {});
                    this.inlineLocalClient = null;
                }
                this.renderInlinePhoneStep(container);
            }
        );

        let codeValue = "";
        const codeInput = fields.createEl("input", { cls: "telegram-auth-input", attr: { type: "text", placeholder: t.AUTH_CODE_PLACEHOLDER } });
        codeInput.addEventListener("input", () => { codeValue = codeInput.value; });
        codeInput.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submitEl.click(); } });
        setTimeout(() => codeInput.focus(), 50);

        submitEl.textContent = t.AUTH_VERIFY_BTN;
        submitEl.addEventListener("click", async () => {
            if (!codeValue.trim() || !this.inlineLocalClient) return;
            submitEl.disabled = true;
            submitEl.textContent = t.AUTH_LOADING;
            try {
                await this.inlineLocalClient.invoke(new Api.auth.SignIn({
                    phoneNumber: state.phone,
                    phoneCodeHash: state.phoneCodeHash,
                    phoneCode: codeValue.trim(),
                }));
                await this.saveInlineLocalSession(state.apiId, state.apiHash);
            } catch (err: any) {
                if (err instanceof Error && err.message.includes("SESSION_PASSWORD_NEEDED")) {
                    this.renderInlineLocalPasswordStep(container, state);
                } else {
                    submitEl.disabled = false;
                    submitEl.textContent = t.AUTH_VERIFY_BTN;
                    new Notice(`${t.AUTH_ERROR}: ${err.message}`);
                }
            }
        });

        noteEl.textContent = t.AUTH_CODE_NOTE;
    }

    private renderInlineLocalPasswordStep(
        container: HTMLElement,
        state: { phone: string; apiId: number; apiHash: string; phoneCodeHash: string }
    ): void {
        const { fields, submitEl, noteEl } = this.buildAuthCard(
            container, t.AUTH_STEP_2,
            () => this.renderInlineLocalCodeStep(container, state)
        );

        let passwordValue = "";
        const passwordInput = fields.createEl("input", { cls: "telegram-auth-input", attr: { type: "password", placeholder: t.AUTH_PASSWORD_PLACEHOLDER } });
        passwordInput.addEventListener("input", () => { passwordValue = passwordInput.value; });
        passwordInput.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submitEl.click(); } });
        setTimeout(() => passwordInput.focus(), 50);

        submitEl.textContent = t.AUTH_VERIFY_BTN;
        submitEl.addEventListener("click", async () => {
            if (!passwordValue.trim() || !this.inlineLocalClient) return;
            submitEl.disabled = true;
            submitEl.textContent = t.AUTH_LOADING;
            try {
                await this.inlineLocalClient.signInWithPassword(
                    { apiId: state.apiId, apiHash: state.apiHash },
                    { password: () => passwordValue.trim() }
                );
                await this.saveInlineLocalSession(state.apiId, state.apiHash);
            } catch (err: any) {
                submitEl.disabled = false;
                submitEl.textContent = t.AUTH_VERIFY_BTN;
                new Notice(`${t.AUTH_ERROR}: ${err.message}`);
            }
        });

        noteEl.textContent = t.AUTH_PASSWORD_REQUIRED;
    }

    private async saveInlineLocalSession(apiId: number, apiHash: string): Promise<void> {
        if (!this.inlineLocalClient) return;
        const session = this.inlineLocalClient.session.save() as unknown as string;
        this.plugin.secrets.telegramSession = session;
        // Don't persist bundled credentials — session alone is enough for reconnection.
        const isBundled = apiId === AUTH_API_ID;
        this.plugin.secrets.telegramApiId = isBundled ? 0 : apiId;
        this.plugin.secrets.telegramApiHash = isBundled ? "" : apiHash;
        await this.plugin.saveSecrets();
        try {
            const me = await this.inlineLocalClient.getMe() as any;
            const parts = [me.firstName, me.lastName].filter(Boolean).join(" ");
            const username = me.username ? ` (@${me.username})` : "";
            this.plugin.settings.telegramDisplayName = `${parts}${username}`;
        } catch {
            this.plugin.settings.telegramDisplayName = "";
        }
        await this.inlineLocalClient.disconnect();
        this.inlineLocalClient = null;
        await this.plugin.saveSettings();
        new Notice(t.AUTH_SUCCESS);
        this.display();
    }
}
