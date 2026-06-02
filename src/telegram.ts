// telegram.ts
import { App, TFile, requestUrl } from "obsidian";
import { convert } from "markdown-to-telegram";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";
import { TelegramChannel, TelegramSettings, TelegramSecrets } from "./types";

// ─── Internal result & media types ────────────────────────────────────────────

interface SendResult {
    link: string;
    messageId: number;
}

interface MediaFile {
    name: string;
    extension: string;
    getBlob: () => Promise<Blob>;
}

// ─── Media type helpers ───────────────────────────────────────────────────────

const VIDEO_EXTS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);

function mediaGroupType(extension: string): "photo" | "video" {
    return VIDEO_EXTS.has(extension) ? "video" : "photo";
}

// ─── Frontmatter extraction ───────────────────────────────────────────────────

function extractFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const body = match ? content.slice(match[0].length) : content;
    if (!match) return { frontmatter: "", body };
    return { frontmatter: match[1], body };
}

// ─── Content preparation ──────────────────────────────────────────────────────

function prepareContent(body: string): string {
    const stripped = body
        .replace(/%%[\s\S]*?%%/g, "")             // Strip Obsidian comments %% ... %%
        .replace(/!\[\[[^\]]*\]\]/g, "")           // Strip wikilink embeds
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // Strip standard MD embeds ![]()
        .replace(/!\([^)]*\)\[[^\]]*\]/g, "")      // Strip reversed MD embeds !()[]
        .replace(/<!--[\s\S]*?-->/g, "")           // Strip HTML comments
        .replace(/[ \t]+\n/g, "\n")
        .trim();

    let result = convert(stripped);
    return result;
}

function prepareContentAccount(body: string): string {
    return body
        .replace(/%%[\s\S]*?%%/g, "")
        .replace(/!\[\[[^\]]*\]\]/g, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/!\([^)]*\)\[[^\]]*\]/g, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
}

// ─── Split helpers ────────────────────────────────────────────────────────────

function splitBodyByMarkers(body: string): string[] {
    const marker = /^[ \t]*(?:%%\s*\\split\s*%%|<!--\s*\\split\s*-->)[ \t]*$/gm;
    return body.split(marker).map(p => p.trim()).filter(p => p.length > 0);
}

// ─── Attachment collection (shared) ───────────────────────────────────────────

const SUPPORTED_MEDIA_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf", ...VIDEO_EXTS]);

function collectMediaFiles(app: App, body: string, sourceFile: TFile): { attachments: MediaFile[]; mdEmbeds: TFile[] } {
    const wikilinkRegex = /!\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g;
    const mdLinkRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    const reverseMdLinkRegex = /!\(([^)]+)\)\[[^\]]*\]/g;

    const seen = new Set<string>();
    const attachments: MediaFile[] = [];
    const mdEmbeds: TFile[] = [];

    const processLinkpath = (rawPath: string) => {
        let cleanPath = rawPath.split(/\s+"/)[0].split(/[?#]/)[0].trim();

        if (/^https?:\/\//i.test(cleanPath)) {
            if (!seen.has(cleanPath)) {
                seen.add(cleanPath);
                const ext = cleanPath.split('.').pop()?.toLowerCase() || "";
                if (SUPPORTED_MEDIA_EXTS.has(ext)) {
                    attachments.push({
                        name: cleanPath.split('/').pop() || `media.${ext}`,
                        extension: ext,
                        getBlob: async () => {
                            const response = await requestUrl({ url: cleanPath });
                            return new Blob([response.arrayBuffer]);
                        }
                    });
                }
            }
            return;
        }

        try { cleanPath = decodeURIComponent(cleanPath); } catch (e) {}

        const resolved = app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
        if (resolved instanceof TFile && !seen.has(resolved.path)) {
            seen.add(resolved.path);
            if (SUPPORTED_MEDIA_EXTS.has(resolved.extension)) {
                attachments.push({
                    name: resolved.name,
                    extension: resolved.extension,
                    getBlob: async () => new Blob([await app.vault.readBinary(resolved)])
                });
            } else if (resolved.extension === "md") {
                mdEmbeds.push(resolved);
            }
        }
    };

    let m: RegExpExecArray | null;
    while ((m = wikilinkRegex.exec(body)) !== null) processLinkpath(m[1]);
    while ((m = mdLinkRegex.exec(body)) !== null) processLinkpath(m[1]);
    while ((m = reverseMdLinkRegex.exec(body)) !== null) processLinkpath(m[1]);

    return { attachments, mdEmbeds };
}

// ─── Post link helpers ────────────────────────────────────────────────────────

function buildPostLink(chat: { id: number; username?: string }, messageId: number): string {
    if (chat.username) return `https://t.me/${chat.username}/${messageId}`;
    const channelId = String(chat.id).replace(/^-100/, "");
    return `https://t.me/c/${channelId}/${messageId}`;
}

function buildPostLinkFromChatId(chatId: string, messageId: number): string {
    if (chatId.startsWith("@")) return `https://t.me/${chatId.slice(1)}/${messageId}`;
    const channelId = chatId.replace(/^-100/, "");
    return `https://t.me/c/${channelId}/${messageId}`;
}

function resolveChatId(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith("@") || /^-?\d+$/.test(trimmed)) return trimmed;
    return `@${trimmed}`;
}

// ─── Bot API: Telegram calls ──────────────────────────────────────────────────

async function getLinkedChatId(channel: TelegramChannel): Promise<number | null> {
    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channel.chatId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return data.result.linked_chat_id ?? null;
}

async function findDiscussionMessageId(botToken: string, linkedChatId: number, channelMessageId: number): Promise<number | null> {
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 1500;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));

        const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 100, allowed_updates: ["message"] })
        });
        const data = await response.json();
        if (!response.ok) continue;

        for (const update of [...data.result].reverse()) {
            const msg = update.message;
            if (!msg || msg.chat.id !== linkedChatId) continue;

            const forwardedFromId = msg.forward_origin?.message_id ?? msg.forward_from_message_id;
            if (forwardedFromId === channelMessageId) return msg.message_id;
        }
    }

    return null;
}

async function sendTextMessage(channel: TelegramChannel, text: string, silent: boolean): Promise<SendResult> {
    const body: Record<string, unknown> = {
        chat_id: channel.chatId,
        text,
        parse_mode: "MarkdownV2",
    };
    if (silent) body.disable_notification = true;

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendReply(botToken: string, chatId: number | string, replyToMessageId: number, text: string, silent: boolean): Promise<void> {
    const body: Record<string, unknown> = {
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text,
        parse_mode: "MarkdownV2",
    };
    if (silent) body.disable_notification = true;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
}

async function sendSinglePhoto(app: App, channel: TelegramChannel, file: MediaFile, caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    formData.append("photo", await file.getBlob(), file.name);
    if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "MarkdownV2");
    }
    if (silent) formData.append("disable_notification", "true");
    if (attachUnderText) formData.append("show_caption_above_media", "true");

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendPhoto`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendAnimation(app: App, channel: TelegramChannel, file: MediaFile, caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    formData.append("animation", await file.getBlob(), file.name);
    if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "MarkdownV2");
    }
    if (silent) formData.append("disable_notification", "true");
    if (attachUnderText) formData.append("show_caption_above_media", "true");

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendAnimation`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendSingleVideo(app: App, channel: TelegramChannel, file: MediaFile, caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    formData.append("video", await file.getBlob(), file.name);
    if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "MarkdownV2");
    }
    if (silent) formData.append("disable_notification", "true");
    if (attachUnderText) formData.append("show_caption_above_media", "true");

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendVideo`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendSingleDocument(app: App, channel: TelegramChannel, file: MediaFile, caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    formData.append("document", await file.getBlob(), file.name);
    if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "MarkdownV2");
    }
    if (silent) formData.append("disable_notification", "true");
    if (attachUnderText) formData.append("show_caption_above_media", "true");

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendDocument`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendMediaGroup(app: App, channel: TelegramChannel, files: MediaFile[], caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    if (silent) formData.append("disable_notification", "true");

    const mediaArray = await Promise.all(files.map(async (file, idx) => {
        const attachName = `file${idx}`;
        formData.append(attachName, await file.getBlob(), file.name);
        return {
            type: mediaGroupType(file.extension),
            media: `attach://${attachName}`,
            ...(idx === 0 && caption ? {
                caption,
                parse_mode: "MarkdownV2",
                show_caption_above_media: attachUnderText
            } : {})
        };
    }));

    formData.append("media", JSON.stringify(mediaArray));
    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMediaGroup`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result[0].chat, data.result[0].message_id),
        messageId: data.result[0].message_id,
    };
}

// ── Finds a configured channel that matches the provided Telegram link

export function findChannelByLink(channels: TelegramChannel[], link: string): TelegramChannel | null {
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

// ─── Bot API: send a single body part ─────────────────────────────────────────

async function sendPartViaBotApi(
    app: App,
    body: string,
    channel: TelegramChannel,
    silent: boolean,
    attachUnderText: boolean,
    sourceFile: TFile,
    treatMdEmbedsAsComments: boolean
): Promise<SendResult | null> {
    const formattedContent = prepareContent(body);
    const { attachments, mdEmbeds } = collectMediaFiles(app, body, sourceFile);

    const photoAndVideoFiles = attachments.filter(f =>
        ["jpg", "jpeg", "png", "webp"].includes(f.extension) || VIDEO_EXTS.has(f.extension)
    );
    const gifFiles = attachments.filter(f => f.extension === "gif");
    const docFiles = attachments.filter(f => f.extension === "pdf");

    let result: SendResult | null = null;
    let captionConsumed = false;

    if (photoAndVideoFiles.length > 0) {
        const firstBatch = photoAndVideoFiles.slice(0, 10);
        const remaining = photoAndVideoFiles.slice(10);

        if (firstBatch.length === 1) {
            const f = firstBatch[0];
            result = VIDEO_EXTS.has(f.extension)
                ? await sendSingleVideo(app, channel, f, formattedContent, silent, attachUnderText)
                : await sendSinglePhoto(app, channel, f, formattedContent, silent, attachUnderText);
        } else {
            result = await sendMediaGroup(app, channel, firstBatch, formattedContent, silent, attachUnderText);
        }
        captionConsumed = true;

        for (const f of remaining) {
            if (VIDEO_EXTS.has(f.extension)) {
                await sendSingleVideo(app, channel, f, "", silent, false);
            } else {
                await sendSinglePhoto(app, channel, f, "", silent, false);
            }
        }
    }

    for (const gif of gifFiles) {
        const caption = captionConsumed ? "" : formattedContent;
        const gifResult = await sendAnimation(app, channel, gif, caption, silent, attachUnderText);
        if (!result) result = gifResult;
        captionConsumed = true;
    }

    if (docFiles.length > 0) {
        const caption = captionConsumed ? "" : formattedContent;
        const firstBatch = docFiles.slice(0, 10);
        const remainingDocs = docFiles.slice(10);
        const docResult = firstBatch.length === 1
            ? await sendSingleDocument(app, channel, firstBatch[0], caption, silent, attachUnderText)
            : await sendMediaGroup(app, channel, firstBatch, caption, silent, attachUnderText);
        if (!result) result = docResult;
        captionConsumed = true;
        for (const doc of remainingDocs) await sendSingleDocument(app, channel, doc, "", silent, false);
    }

    if (!result && formattedContent.length > 0) {
        result = await sendTextMessage(channel, formattedContent, silent);
    }

    // ── Send .md embeds as comments ───────────────────────────────────────────

    if (treatMdEmbedsAsComments && result && mdEmbeds.length > 0) {
        const linkedChatId = await getLinkedChatId(channel);

        for (const mdFile of mdEmbeds) {
            const mdContent = await app.vault.read(mdFile);
            const { body: mdBody } = extractFrontmatter(mdContent);
            const formattedMdContent = prepareContent(mdBody);
            if (formattedMdContent.length === 0) continue;

            if (linkedChatId !== null) {
                const discussionMessageId = await findDiscussionMessageId(channel.botToken, linkedChatId, result.messageId);
                if (discussionMessageId !== null) {
                    await sendReply(channel.botToken, linkedChatId, discussionMessageId, formattedMdContent, silent);
                }
            } else {
                await sendReply(channel.botToken, channel.chatId, result.messageId, formattedMdContent, silent);
            }
        }
    }

    return result;
}

// ─── Account (GramJS) sending ─────────────────────────────────────────────────

// Telegram Desktop api credentials (public, used as fallback for initConnection with existing session)
const DEFAULT_TG_API_ID = 2040;
const DEFAULT_TG_API_HASH = "b18441a1ff607e10a989891a5462e627";

let cachedClient: TelegramClient | null = null;

async function getClient(session: string, apiId?: number, apiHash?: string): Promise<TelegramClient> {
    if (cachedClient?.connected) return cachedClient;
    cachedClient = new TelegramClient(
        new StringSession(session),
        apiId || DEFAULT_TG_API_ID,
        apiHash || DEFAULT_TG_API_HASH,
        { connectionRetries: 3, useWSS: true }
    );
    await cachedClient.connect();
    return cachedClient;
}

export function disconnectClient() {
    if (cachedClient) {
        cachedClient.disconnect();
        cachedClient = null;
    }
}

async function sendPartViaAccount(
    app: App,
    body: string,
    channel: TelegramChannel,
    secrets: TelegramSecrets,
    silent: boolean,
    attachUnderText: boolean,
    sourceFile: TFile,
): Promise<SendResult | null> {
    const text = prepareContentAccount(body);
    const { attachments } = collectMediaFiles(app, body, sourceFile);

    const client = await getClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
    const entity = /^-?\d+$/.test(channel.chatId) ? parseInt(channel.chatId) : channel.chatId;

    const photoAndVideoFiles = attachments.filter(f =>
        ["jpg", "jpeg", "png", "webp"].includes(f.extension) || VIDEO_EXTS.has(f.extension)
    );
    const gifFiles = attachments.filter(f => f.extension === "gif");
    const docFiles = attachments.filter(f => f.extension === "pdf");
    const allMediaFiles = [...photoAndVideoFiles, ...gifFiles];

    if (allMediaFiles.length > 0 || docFiles.length > 0) {
        const filesToSend = allMediaFiles.length > 0 ? allMediaFiles : docFiles;
        const customFiles = await Promise.all(filesToSend.map(async f => {
            const blob = await f.getBlob();
            const data = Buffer.from(await blob.arrayBuffer());
            return new CustomFile(f.name, data.length, "", data);
        }));

        const forceDocument = allMediaFiles.length === 0;
        const fileArg = customFiles.length === 1 ? customFiles[0] : customFiles;

        const result = await client.sendMessage(entity, {
            message: text,
            parseMode: "md",
            file: fileArg,
            forceDocument,
            silent,
            invertMedia: attachUnderText,
        });

        const msg = Array.isArray(result) ? result[0] : result;
        return {
            link: buildPostLinkFromChatId(channel.chatId, msg.id),
            messageId: msg.id,
        };
    } else if (text.length > 0) {
        const result = await client.sendMessage(entity, {
            message: text,
            parseMode: "md",
            silent,
        });
        const msg = Array.isArray(result) ? result[0] : result;
        return {
            link: buildPostLinkFromChatId(channel.chatId, msg.id),
            messageId: msg.id,
        };
    }
    return null;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function sendNoteToTelegram(
    app: App,
    file: TFile,
    tg_channel: TelegramChannel,
    settings: TelegramSettings,
    secrets: TelegramSecrets,
    silent: boolean,
    attachUnderText: boolean,
    treatMdEmbedsAsComments: boolean,
    updateLink?: string
): Promise<{ links: string[]; errors: Error[] }> {
    const channel = { ...tg_channel, chatId: resolveChatId(tg_channel.chatId) };
    const content = await app.vault.read(file);
    const { body } = extractFrontmatter(content);

    const useAccount = !!secrets.telegramSession;

    // ── Update Existing Post (bot API only) ───────────────────────────────────

    if (updateLink && updateLink !== "none") {
        const formattedContent = prepareContent(body);
        const msgIdMatch = updateLink.match(/\/(\d+)\/?$/);
        const messageId = msgIdMatch ? parseInt(msgIdMatch[1], 10) : null;

        if (messageId) {
            let updateBody: Record<string, unknown> = {
                chat_id: channel.chatId,
                message_id: messageId,
                text: formattedContent,
                parse_mode: "MarkdownV2"
            };

            let response = await fetch(`https://api.telegram.org/bot${channel.botToken}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateBody)
            });
            let data = await response.json();

            if (!response.ok && data.description && data.description.includes("there is no text in the message to edit")) {
                updateBody = {
                    chat_id: channel.chatId,
                    message_id: messageId,
                    caption: formattedContent,
                    parse_mode: "MarkdownV2"
                };
                response = await fetch(`https://api.telegram.org/bot${channel.botToken}/editMessageCaption`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updateBody)
                });
                data = await response.json();
            }

            if (!response.ok) throw new Error(data.description);
            return { links: [updateLink], errors: [] };
        }
    }

    // ── Split body and send each part ─────────────────────────────────────────

    const parts = splitBodyByMarkers(body);
    const effectiveParts = parts.length > 0 ? parts : [body];

    const links: string[] = [];
    const errors: Error[] = [];

    for (const part of effectiveParts) {
        try {
            const result = useAccount
                ? await sendPartViaAccount(app, part, channel, secrets, silent, attachUnderText, file)
                : await sendPartViaBotApi(app, part, channel, silent, attachUnderText, file, treatMdEmbedsAsComments);
            if (result) links.push(result.link);
        } catch (err: any) {
            errors.push(err instanceof Error ? err : new Error(String(err)));
        }
    }

    return { links, errors };
}
