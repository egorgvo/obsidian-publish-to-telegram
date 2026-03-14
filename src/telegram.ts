// telegram.ts
import { App, TFile } from "obsidian";
import { convert } from "telegram-markdown-v2";
import { TelegramChannel } from "./types";

// ─── Internal result type ─────────────────────────────────────────────────────

interface SendResult {
    link: string;
    messageId: number;
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
    const withHr = body.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, (hr) => '\u2500'.repeat(hr.length));
    const stripped = withHr.replace(/!\[\[[^\]]*\]\]/g, "").replace(/[ \t]+\n/g, "\n").trim();

    let result = convert(stripped);

    result = result.replace(/^> /gm, '>');
    result = result.replace(/^(\s*)(?:\+|•)\s+/gm, '$1• ');
    result = result.replace(/^(\s*\d+\\\.)\s+/gm, '$1 ');
    result = result.replace(/^(\s*\d+)\)\s+/gm, '$1\\) ');
    return result;
}

// ─── Telegram API calls ───────────────────────────────────────────────────────

function buildPostLink(chat: { id: number; username?: string }, messageId: number): string {
    if (chat.username) return `https://t.me/${chat.username}/${messageId}`;
    const channelId = String(chat.id).replace(/^-100/, "");
    return `https://t.me/c/${channelId}/${messageId}`;
}

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

// After the channel post is sent, Telegram automatically forwards it to the linked
// discussion group. That forwarded copy gets its own message_id in the discussion
// group, but retains a reference to the original via forward_origin.message_id.
// We poll getUpdates (without advancing the offset, so we never consume updates)
// until we find that forwarded copy or run out of attempts.
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

        // Iterate in reverse to check the most recent updates first
        for (const update of [...data.result].reverse()) {
            const msg = update.message;
            if (!msg || msg.chat.id !== linkedChatId) continue;

            // Bot API 7.0+: forward_origin.message_id; older: forward_from_message_id
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

// Replies to a specific message inside a chat (discussion group or group).
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

async function sendSingleMedia(app: App, channel: TelegramChannel, file: TFile, type: "photo" | "document", caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const method = type === "photo" ? "sendPhoto" : "sendDocument";
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    formData.append(type, new Blob([await app.vault.readBinary(file)]), file.name);
    if (caption) {
        formData.append("caption", caption);
        formData.append("parse_mode", "MarkdownV2");
    }
    if (silent) formData.append("disable_notification", "true");
    if (attachUnderText) formData.append("show_caption_above_media", "true");

    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/${method}`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description);
    return {
        link: buildPostLink(data.result.chat, data.result.message_id),
        messageId: data.result.message_id,
    };
}

async function sendMediaGroup(app: App, channel: TelegramChannel, files: TFile[], type: "photo" | "document", caption: string, silent: boolean, attachUnderText: boolean): Promise<SendResult> {
    const formData = new FormData();
    formData.append("chat_id", channel.chatId);
    if (silent) formData.append("disable_notification", "true");

    const mediaArray = await Promise.all(files.map(async (file, idx) => {
        const attachName = `file${idx}`;
        formData.append(attachName, new Blob([await app.vault.readBinary(file)]), file.name);
        return {
            type: type,
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

function resolveChatId(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith("@") || /^-?\d+$/.test(trimmed)) return trimmed;
    return `@${trimmed}`;
}

export async function sendNoteToTelegram(app: App, file: TFile, tg_channel: TelegramChannel, silent: boolean, attachUnderText: boolean, treatMdEmbedsAsComments: boolean): Promise<string | null> {
    const channel = { ...tg_channel, chatId: resolveChatId(tg_channel.chatId) };
    const content = await app.vault.read(file);
    const { body } = extractFrontmatter(content);
    const formattedContent = prepareContent(body);

    const embeddedLinkRegex = /!\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g;
    const supportedMediaExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf"]);
    const seen = new Set<string>();
    const attachments: TFile[] = [];
    const mdEmbeds: TFile[] = [];

    let m: RegExpExecArray | null;
    while ((m = embeddedLinkRegex.exec(body)) !== null) {
        const linkpath = m[1].trim();
        const resolved = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
        if (resolved instanceof TFile && !seen.has(resolved.path)) {
            seen.add(resolved.path);
            if (supportedMediaExts.has(resolved.extension)) {
                attachments.push(resolved);
            } else if (resolved.extension === "md") {
                mdEmbeds.push(resolved);
            }
        }
    }

    const photoFiles = attachments.filter(f => ["jpg", "jpeg", "png", "gif", "webp"].includes(f.extension));
    const docFiles = attachments.filter(f => f.extension === "pdf");

    // ── Send the main post ────────────────────────────────────────────────────

    let result: SendResult | null = null;

    if (photoFiles.length > 0) {
        const firstBatch = photoFiles.slice(0, 10);
        const remainingPhotos = photoFiles.slice(10);
        result = firstBatch.length === 1
            ? await sendSingleMedia(app, channel, firstBatch[0], "photo", formattedContent, silent, attachUnderText)
            : await sendMediaGroup(app, channel, firstBatch, "photo", formattedContent, silent, attachUnderText);
        for (const photo of remainingPhotos) await sendSingleMedia(app, channel, photo, "photo", "", silent, false);
    } else if (docFiles.length > 0) {
        const firstBatch = docFiles.slice(0, 10);
        const remainingDocs = docFiles.slice(10);
        result = firstBatch.length === 1
            ? await sendSingleMedia(app, channel, firstBatch[0], "document", formattedContent, silent, attachUnderText)
            : await sendMediaGroup(app, channel, firstBatch, "document", formattedContent, silent, attachUnderText);
        for (const doc of remainingDocs) await sendSingleMedia(app, channel, doc, "document", "", silent, false);
    } else if (formattedContent.length > 0) {
        result = await sendTextMessage(channel, formattedContent, silent);
    }

    // ── Send .md embeds as comments ───────────────────────────────────────────
    // For channels: find the forwarded copy in the discussion group via getUpdates,
    // then reply to it directly in the discussion group. The forwarded copy has its
    // own message_id there, identified by forward_origin.message_id matching the
    // original channel post. For groups: reply directly in the same chat.

    if (treatMdEmbedsAsComments && result && mdEmbeds.length > 0) {
        const linkedChatId = await getLinkedChatId(channel);

        for (const mdFile of mdEmbeds) {
            const mdContent = await app.vault.read(mdFile);
            const { body: mdBody } = extractFrontmatter(mdContent);
            const formattedMdContent = prepareContent(mdBody);
            if (formattedMdContent.length === 0) continue;

            if (linkedChatId !== null) {
                // Find the discussion group's local copy of the channel post, retrying
                // with a delay since Telegram forwards it asynchronously.
                const discussionMessageId = await findDiscussionMessageId(channel.botToken, linkedChatId, result.messageId);
                if (discussionMessageId !== null) {
                    await sendReply(channel.botToken, linkedChatId, discussionMessageId, formattedMdContent, silent);
                }
            } else {
                await sendReply(channel.botToken, channel.chatId, result.messageId, formattedMdContent, silent);
            }
        }
    }

    return result ? result.link : null;
}
