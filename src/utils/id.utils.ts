/**
 * ID generation utilities
 */

/**
 * Generate a unique step ID
 */
export function generateStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Get (or lazily create + persist) a stable anonymous identifier for this
 * browser. The backend requires a `user_identifier` on every session; this
 * gives each visitor a stable one without any login.
 *
 * Prefixed `pg-player-` to namespace these anonymous browser sessions under a
 * stable, recognizable identifier.
 */
export function getOrCreateUserId(): string {
    const KEY = 'pg_player_id'
    try {
        const existing = localStorage.getItem(KEY)
        if (existing) return existing
        const id = `pg-player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        localStorage.setItem(KEY, id)
        return id
    } catch {
        // localStorage unavailable (e.g. private mode) — fall back to ephemeral.
        return `pg-player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
}
