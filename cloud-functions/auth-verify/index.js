const { TelegramClient, Api } = require("telegram");
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

    const { user_id, code, password } = parsed;
    if (!user_id) {
        return response(404);
    }

    const filePath = path.join(SESSIONS_DIR, `${user_id}.json`);
    if (!fs.existsSync(filePath)) {
        return response(404);
    }

    let state;
    try {
        state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
        return response(404);
    }

    const session = new StringSession(state.session);
    const client = new TelegramClient(session, APP_ID, APP_HASH, {
        connectionRetries: 3,
    });

    try {
        await client.connect();

        if (code) {
            try {
                await client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber: state.phone,
                        phoneCodeHash: state.phoneCodeHash,
                        phoneCode: code,
                    })
                );
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.message.includes("SESSION_PASSWORD_NEEDED")
                ) {
                    if (!password) {
                        // Save updated session before returning
                        state.session = client.session.save();
                        fs.writeFileSync(filePath, JSON.stringify(state));
                        return response(200, { ok: false, reason: "password_required" });
                    }
                    await client.signInWithPassword(
                        { apiId: APP_ID, apiHash: APP_HASH },
                        { password: () => password }
                    );
                } else {
                    return response(404);
                }
            }
        } else if (password) {
            await client.signInWithPassword(
                { apiId: APP_ID, apiHash: APP_HASH },
                { password: () => password }
            );
        } else {
            return response(404);
        }

        const sessionString = client.session.save();
        fs.unlinkSync(filePath);

        return response(200, { session: sessionString });
    } catch {
        return response(404);
    } finally {
        await client.disconnect();
    }
};