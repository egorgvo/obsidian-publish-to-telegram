import { moment } from "obsidian";
import en from "./en";
import ru from "./ru";

const localeMap: { [key: string]: typeof en } = {
    en,
    ru,
};

const lang = moment.locale();
export const t = localeMap[lang] || localeMap.en;

const userGuideFiles: { [key: string]: string } = {
    ru: "USER_GUIDE_RU.md",
};

export function getUserGuideFilename(): string {
    return userGuideFiles[lang] ?? "USER_GUIDE.md";
}
