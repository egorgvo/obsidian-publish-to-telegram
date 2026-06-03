import esbuild from "esbuild";

const prod = process.argv[2] === "production";

const nodeStubPlugin = {
    name: "node-stubs",
    setup(build) {
        const stubModules = ["net", "tls", "fs", "dns", "child_process", "node-localstorage"];
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
