const fs = require("fs");
const path = require("path");

const APP_NAME = process.env.APP_NAME;
const CONFIG_DIR = process.env.CONFIG_DIR;

function response(statusCode, body) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "",
    };
}

function parseVersion(version) {
    return version.split(".").map(Number);
}

function compareVersions(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const partA = a[i] ?? 0;
        const partB = b[i] ?? 0;
        if (partA !== partB) return partA - partB;
    }
    return 0;
}

module.exports.handler = async function handler(event) {
    const appName = event.headers["X-App-Name"] || event.headers["x-app-name"];
    if (!appName || !appName.startsWith(APP_NAME)) {
        return response(404);
    }

    const lastSlash = appName.lastIndexOf("/");
    if (lastSlash === -1) {
        return response(404);
    }

    const versionStr = appName.substring(lastSlash + 1);
    if (!versionStr || versionStr.split(".").some((p) => isNaN(Number(p)))) {
        return response(404);
    }

    const requestedVersion = parseVersion(versionStr);

    const configPath = path.join(CONFIG_DIR, "versions.json");
    if (!fs.existsSync(configPath)) {
        return response(404);
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
        return response(404);
    }

    const configVersions = Object.keys(config)
        .map((key) => ({ key, parsed: parseVersion(key) }))
        .sort((a, b) => compareVersions(a.parsed, b.parsed));

    let matched = null;
    for (const entry of configVersions) {
        if (compareVersions(requestedVersion, entry.parsed) >= 0) {
            matched = entry.key;
        }
    }

    if (!matched) {
        return response(404);
    }

    return response(200, config[matched]);
};