/**
 * Playground auth token storage.
 *
 * The token is a JWT minted by the backend Google-login callback and sent back
 * in the URL fragment. It rides on the `X-Verification-Token` header (see api.ts).
 * A logged-in token makes a session prize-eligible; anonymous play needs none.
 */

const TOKEN_KEY = 'pg_token'

export function getToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY)
    } catch {
        return null
    }
}

export function setToken(token: string): void {
    try {
        localStorage.setItem(TOKEN_KEY, token)
    } catch {
        /* storage unavailable (private mode) - login simply won't persist */
    }
}

export function clearToken(): void {
    try {
        localStorage.removeItem(TOKEN_KEY)
    } catch {
        /* ignore */
    }
}

/**
 * Persist the OAuth token the callback redirects back with, then strip it
 * (and any auth error) from the URL. The current backend uses `#token=...`;
 * `?token=...` is still accepted so older redirects do not break.
 *
 * Run this synchronously BEFORE React mounts (see main.tsx): the session-start
 * request fires from a child effect, which React runs before the AuthProvider
 * (parent) effect - so capturing the token in an effect would let that first
 * post-login session go out anonymous and miss prize eligibility.
 */
export function captureTokenFromUrl(): void {
    try {
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(
            window.location.hash.startsWith('#')
                ? window.location.hash.slice(1)
                : window.location.hash
        )
        const token = hashParams.get('token') ?? searchParams.get('token')
        const hasAuthParams = token || searchParams.has('error') || hashParams.has('error')
        if (!hasAuthParams) return
        if (token) setToken(token)
        searchParams.delete('token')
        searchParams.delete('error')
        hashParams.delete('token')
        hashParams.delete('error')
        const qs = searchParams.toString()
        const hash = hashParams.toString()
        window.history.replaceState(
            {},
            '',
            window.location.pathname + (qs ? `?${qs}` : '')
                + (hash ? `#${hash}` : '')
        )
    } catch {
        /* storage/history unavailable - login simply won't persist */
    }
}
