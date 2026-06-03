const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const APP_ID = Number(process.env.APP_ID);
const APP_HASH = process.env.APP_HASH;
const SESSIONS_DIR = process.env.SESSIONS_DIR;
const APP_NAME = process.env.APP_NAME;

function response(statusCode, body) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "",
    };
}

module.exports.handler = async function handler(event) {
    const appName = event.headers["X-App-Name"] || event.headers["x-app-name"];
    if (!appName || !appName.startsWith(APP_NAME)) {
        return response(404);
    }

    let parsed;
    try {
        parsed = JSON.parse(event.body);
    } catch {
        return response(404);
    }

    const { phone, user_id } = parsed;
    if (!phone || !user_id) {
        return response(404);
    }

    const session = new StringSession("");
    const client = new TelegramClient(session, APP_ID, APP_HASH, {
        connectionRetries: 3,
    });

    try {
        await client.connect();
        const result = await client.sendCode(
            { apiId: APP_ID, apiHash: APP_HASH },
            phone
        );

        const state = {
            phone,
            phoneCodeHash: result.phoneCodeHash,
            session: client.session.save(),
        };

        const filePath = path.join(SESSIONS_DIR, `${user_id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(state));

        return response(200, { ok: true });
    } catch {
        return response(404);
    } finally {
        await client.disconnect();
    }
};