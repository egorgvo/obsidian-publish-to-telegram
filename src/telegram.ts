// telegram.ts
import { App, TFile, requestUrl } from "obsidian";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile, _fileToMedia } from "telegram/client/uploads";
import { _parseMessageText } from "telegram/client/messageParse";
import { getInputMedia } from "telegram/Utils";
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

// ─── Frontmatter extraction ───────────────────────────────────────────────────

function extractFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const body = match ? content.slice(match[0].length) : content;
    if (!match) return { frontmatter: "", body };
    return { frontmatter: match[1], body };
}

// ─── Content preparation ──────────────────────────────────────────────────────

function stripObsidianSyntax(body: string): string {
    return body
        .replace(/%%[\s\S]*?%%/g, "")             // Strip Obsidian comments %% ... %%
        .replace(/!\[\[[^\]]*\]\]/g, "")           // Strip wikilink embeds
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // Strip standard MD embeds ![]()
        .replace(/!\([^)]*\)\[[^\]]*\]/g, "")      // Strip reversed MD embeds !()[]
        .replace(/<!--[\s\S]*?-->/g, "")           // Strip HTML comments
        .replace(/[ \t]+\n/g, "\n")
        .trim();
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Converts Obsidian markdown directly to Telegram-compatible HTML
// for GramJS HTMLParser (supports: b, i, u, s, code, pre, blockquote, a, spoiler)
function mdToTelegramHtml(body: string): string {
    const stripped = stripObsidianSyntax(body);

    // Protect code blocks and inline code from further processing
    const codeBlocks: string[] = [];
    let text = stripped
        .replace(/```(\w*)\n([\s\S]*?)\n?```/g, (_, lang, code) => {
            codeBlocks.push(`<pre>${escHtml(code)}</pre>`);
            return `\x00CB${codeBlocks.length - 1}\x00`;
        })
        .replace(/`([^`\n]+)`/g, (_, c) => {
            codeBlocks.push(`<code>${escHtml(c)}</code>`);
            return `\x00CB${codeBlocks.length - 1}\x00`;
        });

    // Protect escaped characters (\* \_ \~ etc.) from formatting
    const escapes: string[] = [];
    text = text.replace(/\\([\\*_~`|>\-\[\](){}#+.!])/g, (_, ch) => {
        escapes.push(ch);
        return `\x00ES${escapes.length - 1}\x00`;
    });

    // Blockquote: lines starting with > plus lazy continuations (non-empty lines without >)
    const lines = text.split('\n');
    const processed: string[] = [];
    let quoteLines: string[] = [];
    let inQuote = false;

    for (const line of lines) {
        if (/^>/.test(line)) {
            inQuote = true;
            quoteLines.push(line.replace(/^>[ \t]?/, ''));
        } else if (inQuote && line.trim() !== '') {
            quoteLines.push(line);
        } else {
            if (inQuote) {
                processed.push(`<blockquote>${quoteLines.join('\n').trimEnd()}</blockquote>`);
                quoteLines = [];
                inQuote = false;
            }
            processed.push(line);
        }
    }
    if (inQuote) {
        processed.push(`<blockquote>${quoteLines.join('\n').trimEnd()}</blockquote>`);
    }
    text = processed.join('\n');

    // Thematic breaks (---, ___, ***) → horizontal line, preserving length
    text = text.replace(/^[ \t]*([-_*])\1{2,}[ \t]*$/gm, (match) => {
        const len = match.trim().length;
        return '\u2500'.repeat(len);
    });

    // Unordered list markers (*, +, -) → bullet •
    text = text.replace(/^(\s*)(?:\*|\+|-)\s+/gm, '$1• ');

    // Headings → bold
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

    // Bold **text** (multiline: wrap each line separately)
    text = text.replace(/\*\*([^\s*][\s\S]*?)\*\*/g, (_, content) =>
        content.split('\n').map((line: string) => `<b>${line}</b>`).join('\n'));

    // Italic *text* or _text_  (multiline: wrap each line separately)
    text = text.replace(/\*([^\s*][\s\S]*?)\*/g, (_, content) =>
        content.split('\n').map((line: string) => `<i>${line}</i>`).join('\n'));
    text = text.replace(/(?<![\\a-zA-Zа-яА-ЯёЁ])_([^\s_][\s\S]*?)_(?![a-zA-Zа-яА-ЯёЁ])/g, (_, content) =>
        content.split('\n').map((line: string) => `<i>${line}</i>`).join('\n'));

    // Strikethrough ~~text~~  (multiline: wrap each line separately)
    text = text.replace(/~~([^\s~][\s\S]*?)~~/g, (_, content) =>
        content.split('\n').map((line: string) => `<s>${line}</s>`).join('\n'));

    // Spoiler ||text||  (multiline: wrap each line separately)
    text = text.replace(/\|\|([^\s|][\s\S]*?)\|\|/g, (_, content) =>
        content.split('\n').map((line: string) => `<spoiler>${line}</spoiler>`).join('\n'));

    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Restore escaped characters as literal text
    text = text.replace(/\x00ES(\d+)\x00/g, (_, idx) => escHtml(escapes[parseInt(idx)]));

    // Restore code blocks
    text = text.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

    // Collapse multiple blank lines into one
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
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

// ─── Account (GramJS) sending ─────────────────────────────────────────────────

// Telegram Desktop api credentials (public, used as fallback for initConnection with existing session)
const DEFAULT_TG_API_ID = 2040;
const DEFAULT_TG_API_HASH = "b18441a1ff607e10a989891a5462e627";

export async function createClient(session: string, apiId?: number, apiHash?: string): Promise<TelegramClient> {
    const isLocalAuth = !!apiId;
    const client = new TelegramClient(
        new StringSession(session),
        apiId || DEFAULT_TG_API_ID,
        apiHash || DEFAULT_TG_API_HASH,
        { connectionRetries: 5, timeout: 60, ...(isLocalAuth && { useWSS: true }) }
    );
    client.setLogLevel("none" as any);
    await client.connect();
    return client;
}


async function sendCommentViaAccount(
    client: TelegramClient,
    channelEntity: string | number,
    channelMessageId: number,
    text: string,
    silent: boolean,
): Promise<void> {
    // Determine whether there is a linked discussion group
    let hasDiscussion = false;
    try {
        const full = await client.invoke(new Api.channels.GetFullChannel({ channel: channelEntity }));
        hasDiscussion = !!(full.fullChat as Api.ChannelFull).linkedChatId;
    } catch { /* not a channel or no access */ }

    if (hasDiscussion) {
        // Find the discussion-group thread head for this channel post (may need retries if not yet forwarded)
        const MAX_ATTEMPTS = 5;
        const DELAY_MS = 1500;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, DELAY_MS));
            try {
                const discussion = await client.invoke(
                    new Api.messages.GetDiscussionMessage({ peer: channelEntity, msgId: channelMessageId })
                );
                if (!discussion.messages.length) continue;
                // Messages are returned newest-first; the last element is the thread-opening forwarded post
                const threadHead = discussion.messages[discussion.messages.length - 1];
                await client.sendMessage(threadHead.peerId as any, {
                    message: text,
                    parseMode: "html",
                    replyTo: threadHead.id,
                    silent,
                });
                return;
            } catch { /* not ready yet — retry */ }
        }
    } else {
        // No discussion group: reply directly in the channel
        await client.sendMessage(channelEntity, {
            message: text,
            parseMode: "html",
            replyTo: channelMessageId,
            silent,
        });
    }
}

// Sends one or more files with proper invertMedia support via raw MTProto API.
// GramJS's high-level sendMessage/sendFile/sendAlbum do not forward invertMedia,
// so we must build and invoke SendMedia / SendMultiMedia directly.
async function sendMediaRaw(
    client: TelegramClient,
    entity: string | number,
    files: CustomFile[],
    text: string,
    forceDocument: boolean,
    silent: boolean,
    invertMedia: boolean,
): Promise<number> {
    const peer = await client.getInputEntity(entity);
    const [caption, msgEntities] = await _parseMessageText(client, text, "html");

    if (files.length === 1) {
        const ext0 = files[0].name.split('.').pop()?.toLowerCase() ?? "";
        const { media } = await _fileToMedia(client, {
            file: files[0],
            forceDocument,
            workers: 1,
            supportsStreaming: VIDEO_EXTS.has(ext0),
        });
        if (!media) throw new Error("Failed to prepare media for sending");

        const req = new Api.messages.SendMedia({
            peer,
            media,
            message: caption,
            entities: msgEntities,
            silent,
            invertMedia,
        });
        const apiResult = await client.invoke(req);
        const msg = (client as any)._getResponseMessage(req, apiResult, peer);
        const m = Array.isArray(msg) ? msg[0] : msg;
        return (m as Api.Message).id;
    }

    // Album: photos/documents must be pre-uploaded before SendMultiMedia
    const albumItems: Api.InputSingleMedia[] = [];
    for (let i = 0; i < files.length; i++) {
        const ext = files[i].name.split('.').pop()?.toLowerCase() ?? "";
        let { media } = await _fileToMedia(client, {
            file: files[i],
            forceDocument,
            workers: 1,
            supportsStreaming: VIDEO_EXTS.has(ext),
        });
        if (!media) continue;

        if (media instanceof Api.InputMediaUploadedPhoto) {
            const r = await client.invoke(new Api.messages.UploadMedia({ peer, media }));
            if (r instanceof Api.MessageMediaPhoto && r.photo) media = getInputMedia(r.photo);
        } else if (media instanceof Api.InputMediaUploadedDocument) {
            const r = await client.invoke(new Api.messages.UploadMedia({ peer, media }));
            if (r instanceof Api.MessageMediaDocument && r.document) media = getInputMedia(r.document);
        }

        albumItems.push(new Api.InputSingleMedia({
            media: media as Api.TypeInputMedia,
            message: i === 0 ? caption : "",
            entities: i === 0 ? msgEntities : [],
        }));
    }

    const req = new Api.messages.SendMultiMedia({
        peer,
        multiMedia: albumItems,
        silent,
        invertMedia,
    });
    const apiResult = await client.invoke(req);
    const randomIds = albumItems.map(m => (m as any).randomId);
    const msgs = (client as any)._getResponseMessage(randomIds, apiResult, peer);
    const first = Array.isArray(msgs) ? msgs[0] : msgs;
    return (first as Api.Message).id;
}

async function sendPartViaAccount(
    app: App,
    body: string,
    channel: TelegramChannel,
    secrets: TelegramSecrets,
    silent: boolean,
    attachUnderText: boolean,
    sourceFile: TFile,
    treatMdEmbedsAsComments: boolean,
): Promise<SendResult | null> {
    const text = mdToTelegramHtml(body);
    const { attachments, mdEmbeds } = collectMediaFiles(app, body, sourceFile);

    const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
    try {
        const entity = /^-?\d+$/.test(channel.chatId) ? parseInt(channel.chatId) : channel.chatId;

        const photoAndVideoFiles = attachments.filter(f =>
            ["jpg", "jpeg", "png", "webp"].includes(f.extension) || VIDEO_EXTS.has(f.extension)
        );
        const gifFiles = attachments.filter(f => f.extension === "gif");
        const docFiles  = attachments.filter(f => f.extension === "pdf");

        let result: SendResult | null = null;
        let captionConsumed = false;

        // ── Photos and videos: grouped into one album ─────────────────────────────
        if (photoAndVideoFiles.length > 0) {
            const customFiles = await Promise.all(photoAndVideoFiles.map(async f => {
                const blob = await f.getBlob();
                const data = Buffer.from(await blob.arrayBuffer());
                return new CustomFile(f.name, data.length, "", data);
            }));
            const msgId = await sendMediaRaw(client, entity, customFiles, text, false, silent, attachUnderText);
            result = { link: buildPostLinkFromChatId(channel.chatId, msgId), messageId: msgId };
            captionConsumed = true;
        }

        // ── GIFs: each sent individually (must NOT be mixed with videos) ──────────
        for (const gif of gifFiles) {
            const blob = await gif.getBlob();
            const data = Buffer.from(await blob.arrayBuffer());
            const customFile = new CustomFile(gif.name, data.length, "", data);
            const caption = captionConsumed ? "" : text;
            const msgId = await sendMediaRaw(client, entity, [customFile], caption, false, silent,
                !captionConsumed && attachUnderText);
            if (!result) result = { link: buildPostLinkFromChatId(channel.chatId, msgId), messageId: msgId };
            captionConsumed = true;
        }

        // ── PDFs: grouped as documents ────────────────────────────────────────────
        if (docFiles.length > 0) {
            const customFiles = await Promise.all(docFiles.map(async f => {
                const blob = await f.getBlob();
                const data = Buffer.from(await blob.arrayBuffer());
                return new CustomFile(f.name, data.length, "", data);
            }));
            const caption = captionConsumed ? "" : text;
            const msgId = await sendMediaRaw(client, entity, customFiles, caption, true, silent,
                !captionConsumed && attachUnderText);
            if (!result) result = { link: buildPostLinkFromChatId(channel.chatId, msgId), messageId: msgId };
            captionConsumed = true;
        }

        if (!captionConsumed && text.length > 0) {
            const sent = await client.sendMessage(entity, {
                message: text,
                parseMode: "html",
                silent,
            });
            const msg = Array.isArray(sent) ? sent[0] : sent;
            result = { link: buildPostLinkFromChatId(channel.chatId, msg.id), messageId: msg.id };
        }

        if (treatMdEmbedsAsComments && result && mdEmbeds.length > 0) {
            for (const mdFile of mdEmbeds) {
                const mdContent = await app.vault.read(mdFile);
                const { body: mdBody } = extractFrontmatter(mdContent);
                const formattedMdContent = mdToTelegramHtml(mdBody);
                if (!formattedMdContent.length) continue;
                await sendCommentViaAccount(client, entity, result.messageId, formattedMdContent, silent);
            }
        }

        return result;
    } finally {
        await client.destroy();
    }
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

    // ── Update Existing Post ──────────────────────────────────────────────────────

    if (updateLink && updateLink !== "none") {
        const formattedContent = mdToTelegramHtml(body);
        const msgIdMatch = updateLink.match(/\/(\d+)\/?$/);
        const messageId = msgIdMatch ? parseInt(msgIdMatch[1], 10) : null;

        if (messageId) {
            const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
            try {
                const entity = /^-?\d+$/.test(channel.chatId) ? parseInt(channel.chatId) : channel.chatId;
                await client.editMessage(entity, {
                    message: messageId,
                    text: formattedContent,
                    parseMode: "html",
                });
            } finally {
                await client.destroy();
            }
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
            const result = await sendPartViaAccount(app, part, channel, secrets, silent, attachUnderText, file, treatMdEmbedsAsComments);
            if (result) links.push(result.link);
        } catch (err: any) {
            errors.push(err instanceof Error ? err : new Error(String(err)));
        }
    }

    return { links, errors };
}
