import esbuild from "esbuild";

const prod = process.argv[2] === "production";

const nodeStubPlugin = {
    name: "node-stubs",
    setup(build) {
        // browserify-sign / create-ecdh are the only paths that pull in `elliptic`
        // (ECDSA/ECDH). The plugin never signs or does ECDH — Telegram MTProto uses
        // RSA + prime-field DH + AES — so stub them out to drop elliptic (and its
        // advisory, GHSA-848j-6mx2-7j84) from the bundle. crypto-browserify still
        // requires `browserify-sign/algos` (pure JSON), which is unaffected.
        const stubModules = ["net", "tls", "fs", "dns", "child_process", "node-localstorage", "browserify-sign", "create-ecdh"];
        build.onResolve({ filter: new RegExp(`^(node:)?(${stubModules.join("|")})$`) }, (args) => ({
            path: args.path,
            namespace: "node-stub",
        }));
        build.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
            contents: "module.exports = {};",
            loader: "js",
        }));
    },
};

const context = await esbuild.context({
    entryPoints: ["main.ts"],
    bundle: true,
    external: ["obsidian"],
    format: "cjs",
    platform: "browser",
    outfile: "main.js",
    minify: prod,
    define: {
        global: "globalThis",
        "process.env.NODE_ENV": prod ? '"production"' : '"development"',
    },
    alias: {
        path: "path-browserify",
        os: "os-browserify/browser",
        crypto: "crypto-browserify",
        stream: "stream-browserify",
        constants: "constants-browserify",
        assert: "assert",
        util: "./shims/util.js",
        vm: "vm-browserify",
    },
    inject: ["./shims/buffer.js", "./shims/process.js"],
    plugins: [nodeStubPlugin],
});

if (prod) {
    await context.rebuild();
    await context.dispose();
} else {
    await context.watch();
}
