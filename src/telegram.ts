// telegram.ts
import { App, TFile, requestUrl } from "obsidian";
import { TelegramClient, Api } from "telegram";
import { LogLevel } from "telegram/extensions/Logger";
import { StringSession } from "telegram/sessions";
import { CustomFile, _fileToMedia } from "telegram/client/uploads";
import { _parseMessageText } from "telegram/client/messageParse";
import { getInputMedia } from "telegram/Utils";
import { TelegramChannel, TelegramSettings, TelegramSecrets } from "./types";

// ─── Internal result & media types ────────────────────────────────────────────

interface SendResult {
    link: string;
    messageId: number;
    commentLinks?: string[];
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
        .replace(/```(\w*)\n([\s\S]*?)\n?```/g, (_, _lang: string, code: string) => {
            codeBlocks.push(`<pre>${escHtml(code)}</pre>`);
            return `\x00CB${codeBlocks.length - 1}\x00`;
        })
        .replace(/`([^`\n]+)`/g, (_, c: string) => {
            codeBlocks.push(`<code>${escHtml(c)}</code>`);
            return `\x00CB${codeBlocks.length - 1}\x00`;
        });

    // Protect escaped characters (\* \_ \~ etc.) from formatting
    const escapes: string[] = [];
    text = text.replace(/\\([\\*_~`|>\-[\](){}#+.!])/g, (_, ch: string) => {
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
    text = text.replace(/\*\*([^\s*][\s\S]*?)\*\*/g, (_, content: string) =>
        content.split('\n').map((line: string) => `<b>${line}</b>`).join('\n'));

    // Italic *text* or _text_  (multiline: wrap each line separately)
    text = text.replace(/\*([^\s*][\s\S]*?)\*/g, (_, content: string) =>
        content.split('\n').map((line: string) => `<i>${line}</i>`).join('\n'));
    text = text.replace(/(?<![\\a-zA-Zа-яА-ЯёЁ])_([^\s_][\s\S]*?)_(?![a-zA-Zа-яА-ЯёЁ])/g, (_, content: string) =>
        content.split('\n').map((line: string) => `<i>${line}</i>`).join('\n'));

    // Strikethrough ~~text~~  (multiline: wrap each line separately)
    text = text.replace(/~~([^\s~][\s\S]*?)~~/g, (_, content: string) =>
        content.split('\n').map((line: string) => `<s>${line}</s>`).join('\n'));

    // Spoiler ||text||  (multiline: wrap each line separately)
    text = text.replace(/\|\|([^\s|][\s\S]*?)\|\|/g, (_, content: string) =>
        content.split('\n').map((line: string) => `<spoiler>${line}</spoiler>`).join('\n'));

    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Restore escaped characters as literal text
    // eslint-disable-next-line no-control-regex -- \x00 sentinels delimit protected escape spans
    text = text.replace(/\x00ES(\d+)\x00/g, (_, idx: string) => escHtml(escapes[parseInt(idx)]));

    // Restore code blocks
    // eslint-disable-next-line no-control-regex -- \x00 sentinels delimit protected code spans
    text = text.replace(/\x00CB(\d+)\x00/g, (_, idx: string) => codeBlocks[parseInt(idx)]);

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

        try { cleanPath = decodeURIComponent(cleanPath); } catch { /* keep raw path if not URI-encoded */ }

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

function buildPostLinkFromChatId(chatId: string, messageId: number, topicId?: number): string {
    const withTopic = topicId && topicId !== 1;
    if (chatId.startsWith("@")) {
        if (withTopic) return `https://t.me/${chatId.slice(1)}/${topicId}/${messageId}`;
        return `https://t.me/${chatId.slice(1)}/${messageId}`;
    }
    const channelId = chatId.replace(/^-100/, "");
    if (withTopic) return `https://t.me/c/${channelId}/${topicId}/${messageId}`;
    return `https://t.me/c/${channelId}/${messageId}`;
}

function parseLinkComponents(link: string): { chatId: string; messageId: number } | null {
    const privateMatch = link.match(/t\.me\/c\/(\d+)\/(\d+)\/?$/);
    if (privateMatch) return { chatId: `-100${privateMatch[1]}`, messageId: parseInt(privateMatch[2], 10) };
    const publicMatch = link.match(/t\.me\/([^/]+)\/(\d+)\/?$/);
    if (publicMatch) return { chatId: `@${publicMatch[1]}`, messageId: parseInt(publicMatch[2], 10) };
    return null;
}

function resolveChatId(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith("@") || /^-?\d+$/.test(trimmed)) return trimmed;
    return `@${trimmed}`;
}

// ─── Account (GramJS) sending ─────────────────────────────────────────────────

// Telegram Desktop api credentials (public, used as fallback for initConnection with existing session)
export const DEFAULT_TG_API_ID = 2040;
export const DEFAULT_TG_API_HASH = "b18441a1ff607e10a989891a5462e627";

// Plugin-specific credentials for new session creation (QR and phone auth).
// Register your own app at https://my.telegram.org → API Development Tools.
// Using Telegram Desktop's credentials (above) for new auth is blocked server-side.
export const AUTH_API_ID = 2040;
export const AUTH_API_HASH = "b18441a1ff607e10a989891a5462e627";

export async function createClient(session: string, apiId?: number, apiHash?: string): Promise<TelegramClient> {
    const isLocalAuth = !!apiId;
    const client = new TelegramClient(
        new StringSession(session),
        apiId || DEFAULT_TG_API_ID,
        apiHash || DEFAULT_TG_API_HASH,
        { connectionRetries: 5, timeout: 60, ...(isLocalAuth && { useWSS: true }) }
    );
    client.setLogLevel(LogLevel.NONE);
    // This plugin is request-only (no addEventHandler / incoming updates), so
    // GramJS's update loop serves no purpose — its sole job here is keepalive
    // pings, and a failed ping throws an uncaught "TIMEOUT" that surfaces to the
    // user. Pre-setting _loopStarted stops connect() from ever launching it.
    (client as unknown as { _loopStarted: boolean })._loopStarted = true;
    await client.connect();
    return client;
}


export async function checkIsForum(client: TelegramClient, entity: string | number): Promise<boolean> {
    try {
        const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
        return !!(full.chats[0] as Api.Channel)?.forum;
    } catch {
        return false;
    }
}

// `_getResponseMessage` is a private GramJS method that resolves the sent
// message(s) from a raw MTProto result. Typed wrapper around the private access.
function getResponseMessage(
    client: TelegramClient,
    req: unknown,
    result: unknown,
    peer: unknown,
): Api.TypeMessage | Map<number, Api.Message> | (Api.Message | undefined)[] | undefined {
    return (client as unknown as {
        _getResponseMessage(req: unknown, result: unknown, inputChat: unknown):
            Api.TypeMessage | Map<number, Api.Message> | (Api.Message | undefined)[] | undefined;
    })._getResponseMessage(req, result, peer);
}

// ─── Dialog listing ───────────────────────────────────────────────────────────

export interface DialogData {
    id: string;       // "@username" for public, "-100XXXX" for channels, numeric string for others
    title: string;
    topicId?: number; // set for forum topics; 1 = General (also set on the parent group entry)
}

export async function getUserDialogs(client: TelegramClient): Promise<DialogData[]> {
    try {
        const results: DialogData[] = [];
        for await (const dialog of client.iterDialogs({ limit: 300, folder: 0 })) {
            if (!dialog.title) continue;
            const entity = dialog.entity;
            if (!entity) continue;

            // Narrow the entity union once; only channels/chats expose the fields we use.
            const channel = entity instanceof Api.Channel ? entity : null;
            const chat = entity instanceof Api.Chat ? entity : null;
            const username = entity instanceof Api.User || entity instanceof Api.Channel
                ? entity.username
                : undefined;

            // Skip entities where the user cannot post messages
            if (channel) {
                if (channel.broadcast) {
                    // Broadcast channel: only creators/admins with postMessages right can post
                    if (!channel.creator && !channel.adminRights?.postMessages) continue;
                } else {
                    // Supergroup: skip if non-admins are banned from sending messages
                    if (!channel.creator && !channel.adminRights && channel.defaultBannedRights?.sendMessages) continue;
                }
            }

            let id: string;
            if (username) {
                id = `@${username}`;
            } else if (channel) {
                id = `-100${channel.id.toString()}`;
            } else if (chat) {
                id = `-${chat.id.toString()}`;
            } else {
                id = "id" in entity ? entity.id.toString() : "";
            }
            if (!id) continue;
            const title = username ? `${dialog.title} (@${username})` : dialog.title;

            const isForum = !!(channel && channel.forum && channel.accessHash);
            results.push({ id, title, topicId: isForum ? 1 : undefined });

            // Fetch topics for forum supergroups and append them as individual entries
            if (isForum && channel) {
                try {
                    const inputChannel = new Api.InputChannel({
                        channelId: channel.id,
                        accessHash: channel.accessHash!,
                    });
                    const topicsResult = await client.invoke(new Api.channels.GetForumTopics({
                        channel: inputChannel,
                        offsetDate: 0,
                        offsetId: 0,
                        offsetTopic: 0,
                        limit: 100,
                    }));
                    for (const topic of topicsResult.topics) {
                        if (!(topic instanceof Api.ForumTopic)) continue;
                        if (topic.id === 1) continue; // skip General — covered by the group entry
                        results.push({ id, title: `${title}: ${topic.title}`, topicId: topic.id });
                    }
                } catch {
                    // topic fetch failed — group entry without topics is still usable
                }
            }
        }
        return results;
    } catch {
        return [];
    }
}

async function sendCommentViaAccount(
    client: TelegramClient,
    channelEntity: string | number,
    channelChatId: string,
    channelMessageId: number,
    text: string,
    silent: boolean,
): Promise<string | null> {
    // Determine whether the channel has a linked discussion group, and resolve the
    // correct sendAs peer so the comment is attributed to the right identity.
    //
    // Rule: private channels (no public username) cannot post as themselves in a
    // discussion group, so we use InputPeerSelf to post as the user's account
    // instead of leaving sendAs undefined (which would let Telegram silently pick
    // whatever channel the user last used in that group).
    //
    // For public channels we go through GetSendAs and match by channel ID to get
    // the server-authoritative InputPeer (required — Telegram rejects a self-built
    // one with SEND_AS_PEER_INVALID).
    let hasDiscussion = false;
    let sendAsPeer: Api.TypeInputPeer | undefined;
    let linkedGroupChatId: string | undefined;
    try {
        const full = await client.invoke(new Api.channels.GetFullChannel({ channel: channelEntity }));
        const fullChat = full.fullChat as Api.ChannelFull;
        const linkedChatId = fullChat.linkedChatId;
        hasDiscussion = !!linkedChatId;

        if (hasDiscussion && linkedChatId) {
            linkedGroupChatId = `-100${linkedChatId.toString()}`;
            const groupChat = full.chats.find(c => c.id.eq(linkedChatId)) as Api.Channel | undefined;
            const sourceChannel = full.chats.find(c => !c.id.eq(linkedChatId)) as Api.Channel | undefined;
            const isPrivate = !sourceChannel?.username;

            if (groupChat?.accessHash) {
                try {
                    const groupInputPeer = new Api.InputPeerChannel({
                        channelId: groupChat.id,
                        accessHash: groupChat.accessHash,
                    });
                    const sendAsResult = await client.invoke(
                        new Api.channels.GetSendAs({ peer: groupInputPeer })
                    );

                    if (isPrivate) {
                        // Private channel: post as the user's personal account.
                        // Prefer the InputPeer from the GetSendAs list (server-authoritative
                        // access hash). If the personal account is not in that list (it only
                        // appears when the account is a direct group member/admin), fall back
                        // to resolving it from the GramJS entity cache via getMe().
                        const userPeer = sendAsResult.peers.find(p => p.peer instanceof Api.PeerUser);
                        if (userPeer && userPeer.peer instanceof Api.PeerUser) {
                            const userId = userPeer.peer.userId;
                            const matchingUser = sendAsResult.users.find(u => u.id.eq(userId)) as Api.User | undefined;
                            if (matchingUser) {
                                sendAsPeer = new Api.InputPeerUser({
                                    userId: matchingUser.id,
                                    accessHash: matchingUser.accessHash!,
                                });
                            }
                        }
                        if (!sendAsPeer) {
                            const me = await client.getMe() as Api.User | null;
                            if (me) {
                                const meInputPeer = await client.getInputEntity(me);
                                if (meInputPeer instanceof Api.InputPeerUser) sendAsPeer = meInputPeer;
                            }
                        }
                    } else {
                        // Public channel: post as the channel itself.
                        const channelInputPeer = await client.getInputEntity(channelEntity);
                        const channelId = channelInputPeer instanceof Api.InputPeerChannel
                            ? channelInputPeer.channelId : null;
                        if (channelId) {
                            const matchingPeer = sendAsResult.peers.find(p =>
                                p.peer instanceof Api.PeerChannel && p.peer.channelId.eq(channelId)
                            );
                            if (matchingPeer && matchingPeer.peer instanceof Api.PeerChannel) {
                                const peerId = matchingPeer.peer.channelId;
                                const matchingChat = sendAsResult.chats.find(c => c.id.eq(peerId)) as Api.Channel | undefined;
                                if (matchingChat?.accessHash) {
                                    sendAsPeer = new Api.InputPeerChannel({
                                        channelId: matchingChat.id,
                                        accessHash: matchingChat.accessHash,
                                    });
                                }
                            }
                        }
                    }
                } catch { /* GetSendAs unavailable — comment will post as user default */ }
            }
        }
    } catch { /* not a channel or no access */ }

    if (hasDiscussion) {
        // Find the discussion-group thread head for this channel post (may need retries if not yet forwarded)
        const MAX_ATTEMPTS = 5;
        const DELAY_MS = 1500;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (attempt > 0) await new Promise(r => window.setTimeout(r, DELAY_MS));

            // Only the discovery call is retried — a missing/not-yet-forwarded message is expected.
            // Errors from the actual send must not be swallowed here so they surface to the caller.
            let threadHead: Api.TypeMessage | undefined;
            try {
                const discussion = await client.invoke(
                    new Api.messages.GetDiscussionMessage({ peer: channelEntity, msgId: channelMessageId })
                );
                if (!discussion.messages.length) continue;
                // Messages are returned newest-first; the last element is the thread-opening forwarded post
                threadHead = discussion.messages[discussion.messages.length - 1];
            } catch { continue; /* not ready yet — retry */ }

            // Use raw MTProto so sendAs (InputPeer) reaches the wire unambiguously;
            // the high-level sendMessage wrapper does not reliably propagate it.
            const [message, entities] = await _parseMessageText(client, text, "html");
            const peer = await client.getInputEntity(threadHead.peerId);
            const req = new Api.messages.SendMessage({
                peer,
                message,
                entities,
                replyTo: new Api.InputReplyToMessage({ replyToMsgId: threadHead.id }),
                silent,
                sendAs: sendAsPeer,
            });
            const apiResult = await client.invoke(req);
            const m = getResponseMessage(client, req, apiResult, peer);
            const sent = Array.isArray(m) ? m[0] : m;
            const sentMsgId = (sent as Api.Message | undefined)?.id;
            if (sentMsgId && linkedGroupChatId) return buildPostLinkFromChatId(linkedGroupChatId, sentMsgId);
            return null;
        }
        return null;
    } else {
        // No discussion group: reply directly in the channel
        const sent = await client.sendMessage(channelEntity, {
            message: text,
            parseMode: "html",
            replyTo: channelMessageId,
            silent,
        });
        return buildPostLinkFromChatId(channelChatId, sent.id);
    }
}

// Edits existing pre-written comments using stored links, or sends new ones for
// embeds that have no stored link yet. Returns true if any comment changed.
async function updateCommentsForPost(
    client: TelegramClient,
    channelEntity: string | number,
    channelChatId: string,
    channelMessageId: number,
    mdEmbeds: TFile[],
    app: App,
    existingCommentLinks: string[],
    silent: boolean,
): Promise<boolean> {
    let anyChanged = false;

    for (let i = 0; i < mdEmbeds.length; i++) {
        const mdContent = await app.vault.read(mdEmbeds[i]);
        const { body: mdBody } = extractFrontmatter(mdContent);
        const formattedContent = mdToTelegramHtml(mdBody);
        if (!formattedContent.length) continue;

        if (i < existingCommentLinks.length) {
            const parsed = parseLinkComponents(existingCommentLinks[i]);
            if (parsed) {
                const peer: string | number = /^-?\d+$/.test(parsed.chatId) ? parseInt(parsed.chatId) : parsed.chatId;
                try {
                    await client.editMessage(peer, {
                        message: parsed.messageId,
                        text: formattedContent,
                        parseMode: "html",
                    });
                    anyChanged = true;
                } catch (err) {
                    if (!String((err as any)?.message ?? "").includes("MESSAGE_NOT_MODIFIED")) throw err;
                }
            }
        } else {
            await sendCommentViaAccount(client, channelEntity, channelChatId, channelMessageId, formattedContent, silent);
            anyChanged = true;
        }
    }

    return anyChanged;
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
    scheduleDate?: number,
    topicId?: number,
): Promise<number> {
    const peer = await client.getInputEntity(entity);
    const [caption, msgEntities] = await _parseMessageText(client, text, "html");
    const replyTo = topicId
        ? new Api.InputReplyToMessage({ replyToMsgId: topicId, topMsgId: topicId })
        : undefined;

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
            scheduleDate,
            replyTo,
        });
        const apiResult = await client.invoke(req);
        const msg = getResponseMessage(client, req, apiResult, peer);
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
            media: media,
            message: i === 0 ? caption : "",
            entities: i === 0 ? msgEntities : [],
        }));
    }

    const req = new Api.messages.SendMultiMedia({
        peer,
        multiMedia: albumItems,
        silent,
        invertMedia,
        scheduleDate,
        replyTo,
    });
    const apiResult = await client.invoke(req);
    const randomIds = albumItems.map(m => m.randomId);
    const msgs = getResponseMessage(client, randomIds, apiResult, peer);
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
    scheduleDate?: Date,
    onProgress?: () => void,
): Promise<SendResult | null> {
    const text = mdToTelegramHtml(body);
    const { attachments, mdEmbeds } = collectMediaFiles(app, body, sourceFile);
    const scheduleDateUnix = scheduleDate ? Math.floor(scheduleDate.getTime() / 1000) : undefined;

    const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
    try {
        const entity = /^-?\d+$/.test(channel.chatId) ? parseInt(channel.chatId) : channel.chatId;
        const topicId = channel.topicId;

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
            const msgId = await sendMediaRaw(client, entity, customFiles, text, false, silent, attachUnderText, scheduleDateUnix, topicId);
            result = { link: buildPostLinkFromChatId(channel.chatId, msgId, topicId), messageId: msgId };
            captionConsumed = true;
        }

        // ── GIFs: each sent individually (must NOT be mixed with videos) ──────────
        for (const gif of gifFiles) {
            const blob = await gif.getBlob();
            const data = Buffer.from(await blob.arrayBuffer());
            const customFile = new CustomFile(gif.name, data.length, "", data);
            const caption = captionConsumed ? "" : text;
            const msgId = await sendMediaRaw(client, entity, [customFile], caption, false, silent,
                !captionConsumed && attachUnderText, scheduleDateUnix, topicId);
            if (!result) result = { link: buildPostLinkFromChatId(channel.chatId, msgId, topicId), messageId: msgId };
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
                !captionConsumed && attachUnderText, scheduleDateUnix, topicId);
            if (!result) result = { link: buildPostLinkFromChatId(channel.chatId, msgId, topicId), messageId: msgId };
            captionConsumed = true;
        }

        if (!captionConsumed && text.length > 0) {
            let msgId: number;
            if (topicId) {
                const peer = await client.getInputEntity(entity);
                const [message, entities] = await _parseMessageText(client, text, "html");
                const req = new Api.messages.SendMessage({
                    peer,
                    message,
                    entities,
                    silent,
                    scheduleDate: scheduleDateUnix,
                    replyTo: new Api.InputReplyToMessage({ replyToMsgId: topicId, topMsgId: topicId }),
                });
                const apiResult = await client.invoke(req);
                const m = getResponseMessage(client, req, apiResult, peer);
                const msg = Array.isArray(m) ? m[0] : m;
                msgId = (msg as Api.Message).id;
            } else {
                const sent = await client.sendMessage(entity, {
                    message: text,
                    parseMode: "html",
                    silent,
                    schedule: scheduleDateUnix,
                });
                msgId = sent.id;
            }
            result = { link: buildPostLinkFromChatId(channel.chatId, msgId, topicId), messageId: msgId };
        }

        if (treatMdEmbedsAsComments && result && mdEmbeds.length > 0 && !scheduleDate) {
            onProgress?.();
            const commentLinks: string[] = [];
            for (const mdFile of mdEmbeds) {
                const mdContent = await app.vault.read(mdFile);
                const { body: mdBody } = extractFrontmatter(mdContent);
                const formattedMdContent = mdToTelegramHtml(mdBody);
                if (!formattedMdContent.length) continue;
                const commentLink = await sendCommentViaAccount(client, entity, channel.chatId, result.messageId, formattedMdContent, silent);
                if (commentLink) commentLinks.push(commentLink);
            }
            if (commentLinks.length > 0) result = { ...result, commentLinks };
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
    updateLink?: string,
    scheduleDate?: Date,
    onProgress?: () => void,
): Promise<{ links: string[]; commentLinksByPostLink: Record<string, string[]>; errors: Error[] }> {
    const channel = { ...tg_channel, chatId: resolveChatId(tg_channel.chatId) };
    const content = await app.vault.read(file);
    const { body } = extractFrontmatter(content);

    // ── Update Existing Post ──────────────────────────────────────────────────────

    if (updateLink && updateLink !== "none") {
        const formattedContent = mdToTelegramHtml(body);
        const msgIdMatch = updateLink.match(/\/(\d+)\/?$/);
        const messageId = msgIdMatch ? parseInt(msgIdMatch[1], 10) : null;

        if (messageId) {
            const { mdEmbeds } = collectMediaFiles(app, body, file);
            const client = await createClient(secrets.telegramSession, secrets.telegramApiId, secrets.telegramApiHash);
            try {
                const entity = /^-?\d+$/.test(channel.chatId) ? parseInt(channel.chatId) : channel.chatId;

                let postChanged = false;
                try {
                    await client.editMessage(entity, {
                        message: messageId,
                        text: formattedContent,
                        parseMode: "html",
                    });
                    postChanged = true;
                } catch (err) {
                    if (!String((err as any)?.message ?? "").includes("MESSAGE_NOT_MODIFIED")) throw err;
                }

                let commentsChanged = false;
                if (treatMdEmbedsAsComments && mdEmbeds.length > 0) {
                    onProgress?.();
                    const fileCache = app.metadataCache.getFileCache(file);
                    const storedCommentLinks = ((fileCache?.frontmatter?.telegram_comment_links ?? {}) as Record<string, string[]>)[updateLink] ?? [];
                    commentsChanged = await updateCommentsForPost(client, entity, channel.chatId, messageId, mdEmbeds, app, storedCommentLinks, silent);
                }

                if (!postChanged && !commentsChanged) {
                    return { links: [updateLink], commentLinksByPostLink: {}, errors: [new Error("MESSAGE_NOT_MODIFIED")] };
                }
            } finally {
                await client.destroy();
            }
            return { links: [updateLink], commentLinksByPostLink: {}, errors: [] };
        }
    }

    // ── Split body and send each part ─────────────────────────────────────────

    const parts = splitBodyByMarkers(body);
    const effectiveParts = parts.length > 0 ? parts : [body];

    const links: string[] = [];
    const commentLinksByPostLink: Record<string, string[]> = {};
    const errors: Error[] = [];

    for (const part of effectiveParts) {
        try {
            const result = await sendPartViaAccount(app, part, channel, secrets, silent, attachUnderText, file, treatMdEmbedsAsComments, scheduleDate, onProgress);
            if (result) {
                links.push(result.link);
                if (result.commentLinks?.length) commentLinksByPostLink[result.link] = result.commentLinks;
            }
        } catch (err) {
            errors.push(err instanceof Error ? err : new Error(String(err)));
        }
    }

    return { links, commentLinksByPostLink, errors };
}
