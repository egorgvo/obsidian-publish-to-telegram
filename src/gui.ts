import { App, Modal, ButtonComponent, ToggleComponent, Notice, TFile, MarkdownRenderer, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { t } from "../lang/helpers";
import type SendToTelegramPlugin from "../main";

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

// ─── Settings Tab ─────────────────────────────────────────────────────────────

export class TelegramSettingTab extends PluginSettingTab {
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
                new FormattingHelpModal(this.app, this.plugin).open();
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