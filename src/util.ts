// Shared error-handling helpers.

// Safely extracts a message from an unknown caught value.
export function errMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

// Extracts a Telegram/GramJS error code (RPCError.errorMessage), falling back to
// the standard message — mirrors the old `err.errorMessage ?? err.message ?? ""`.
export function errCode(err: unknown): string {
    if (err && typeof err === "object") {
        const e = err as { errorMessage?: unknown; message?: unknown };
        if (typeof e.errorMessage === "string") return e.errorMessage;
        if (typeof e.message === "string") return e.message;
    }
    return "";
}
