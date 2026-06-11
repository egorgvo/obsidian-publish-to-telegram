import { moment } from "obsidian";
import en from "./en";
import ru from "./ru";
import userGuideEn from "../USER_GUIDE.md";
import userGuideRu from "../USER_GUIDE_RU.md";
import changelogMd from "../CHANGELOG.md";

const localeMap: { [key: string]: typeof en } = {
    en,
    ru,
};

const lang = moment.locale();
export const t = localeMap[lang] || localeMap.en;

const userGuideContents: { [key: string]: string } = {
    ru: userGuideRu,
};

export function getUserGuideContent(): string {
    return userGuideContents[lang] ?? userGuideEn;
}

export const changelogContent = changelogMd;
