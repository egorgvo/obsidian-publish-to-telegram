export interface TelegramChannel {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
    isDefault: boolean;
}

export interface TelegramSettings {
    channels: TelegramChannel[];
}

export const DEFAULT_SETTINGS: TelegramSettings = {
    channels: []
}