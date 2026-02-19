import { moment } from "obsidian";
import en from "./en";
import ru from "./ru";

const localeMap: { [key: string]: typeof en } = {
    en,
    ru,
};

const lang = moment.locale();
export const t = localeMap[lang] || localeMap.en;