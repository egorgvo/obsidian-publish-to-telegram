export interface TelegramChannel {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
    isDefault: boolean;
}

export interface TelegramSettings {
    channels: TelegramChannel[];
    savePostLinks: boolean;
    treatMdEmbedsAsComments: boolean;
    configUrl: string;
    telegramSession: string;
    telegramDisplayName: string;
    telegramApiId: number;
    telegramApiHash: string;
}

export const DEFAULT_SETTINGS: TelegramSettings = {
    channels: [],
    savePostLinks: false,
    treatMdEmbedsAsComments: false,
    configUrl: "https://functions.yandexcloud.net/d4es24t8ce9jesmb38qd",
    telegramSession: "",
    telegramDisplayName: "",
    telegramApiId: 0,
    telegramApiHash: "",
}
