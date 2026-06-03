export function inspect(obj, opts) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

export function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}

export function deprecate(fn) { return fn; }
export function debuglog() { return function() {}; }
export function format(...args) { return args.map(String).join(" "); }
export function promisify(fn) {
    return function(...args) {
        return new Promise((resolve, reject) => {
            fn(...args, (err, result) => err ? reject(err) : resolve(result));
        });
    };
}

export default { inspect, inherits, deprecate, debuglog, format, promisify };
