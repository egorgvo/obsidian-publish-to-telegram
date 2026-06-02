import { requestUrl } from "obsidian";

const APP_NAME = "publish-to-telegram";

export interface CloudConfig {
    auth_start_url: string;
    auth_verify_url: string;
}

export interface AuthVerifyResult {
    ok?: boolean;
    reason?: string;
    session?: string;
}

export async function fetchConfig(configUrl: string, version: string): Promise<CloudConfig> {
    const resp = await requestUrl({
        url: configUrl,
        method: "POST",
        headers: { "X-App-Name": `${APP_NAME}/${version}` },
    });
    if (resp.status !== 200) throw new Error("Failed to fetch config");
    return resp.json;
}

export async function startAuth(authStartUrl: string, phone: string, userId: string, version: string): Promise<void> {
    const resp = await requestUrl({
        url: authStartUrl,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-App-Name": `${APP_NAME}/${version}`,
        },
        body: JSON.stringify({ phone, user_id: userId }),
    });
    if (resp.status !== 200 || !resp.json.ok) throw new Error("Failed to send auth code");
}

export async function verifyAuth(authVerifyUrl: string, userId: string, version: string, code?: string, password?: string): Promise<AuthVerifyResult> {
    const body: Record<string, string> = { user_id: userId };
    if (code) body.code = code;
    if (password) body.password = password;

    const resp = await requestUrl({
        url: authVerifyUrl,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-App-Name": `${APP_NAME}/${version}`,
        },
        body: JSON.stringify(body),
    });
    if (resp.status !== 200) throw new Error("Verification failed");
    return resp.json;
}
