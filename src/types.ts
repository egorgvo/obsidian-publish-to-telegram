export interface ChatTarget {
    id: string;
    title?: string;
    topicId?: number;
}

export interface TelegramChannel {
    id: string;
    name: string;
    chatTargets: ChatTarget[];
    chatId: string;        // legacy field — kept for telegram.ts compat; synced to chatTargets[0].id
    chatTitle?: string;    // legacy field — synced to chatTargets[0].title
    isDefault: boolean;
    topicId?: number;
}

export interface TelegramSettings {
    channels: TelegramChannel[];
    savePostLinks: boolean;
    treatMdEmbedsAsComments: boolean;
    telegramDisplayName: string;
    dismissedChangelogVersion?: string;
}

export interface TelegramSecrets {
    telegramSession: string;
    telegramApiId: number;
    telegramApiHash: string;
}

export const DEFAULT_SETTINGS: TelegramSettings = {
    channels: [],
    savePostLinks: false,
    treatMdEmbedsAsComments: false,
    telegramDisplayName: "",
}
