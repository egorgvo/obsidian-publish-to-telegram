export interface TelegramChannel {
    id: string;
    name: string;
    chatId: string;
    isDefault: boolean;
    topicId?: number;
}

export interface TelegramSettings {
    channels: TelegramChannel[];
    savePostLinks: boolean;
    treatMdEmbedsAsComments: boolean;
    configUrl: string;
    telegramDisplayName: string;
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
    configUrl: "https://functions.yandexcloud.net/d4es24t8ce9jesmb38qd",
    telegramDisplayName: "",
}
