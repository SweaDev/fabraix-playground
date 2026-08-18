/**
 * Playground auth context.
 *
 * Wraps the app so any component can read the logged-in player (or null) and
 * trigger Google login / display-name updates. On mount it captures the
 * token the backend OAuth callback redirects back with, persists it, cleans the
 * URL, then resolves the current user via /auth/me.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'
import {
    fetchMe,
    startPlaygroundLogin,
    updateDisplayName as apiUpdateDisplayName,
    type PlaygroundUser,
} from '@/api'
import { clearToken, getToken } from '@/utils/auth'
import { SESSION_STORAGE_KEY } from '@/hooks/useSessionStorage'

interface AuthContextValue {
    /** The logged-in player, or null when anonymous. */
    user: PlaygroundUser | null
    /** True while the initial /auth/me resolves. */
    isLoading: boolean
    /** Redirect to Google to log in. */
    login: () => Promise<void>
    /** Forget the local token. */
    logout: () => void
    /** Set/update the leaderboard display name. */
    setDisplayName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PlaygroundUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // The OAuth token is captured into storage before React mounts
        // (captureTokenFromUrl in main.tsx) so the first session is owned; here we
        // just resolve the stored token (if any) into the current user.
        if (!getToken()) {
            setIsLoading(false)
            return
        }

        fetchMe()
            .then(setUser)
            .catch(() => {
                clearToken()
                setUser(null)
            })
            .finally(() => setIsLoading(false))
    }, [])

    const login = useCallback(async () => {
        const { authUrl } = await startPlaygroundLogin()
        // Drop any in-flight anonymous game so the post-login session starts fresh
        // and is stamped to this account from the first message (D1 - no upgrading
        // an anonymous session, whose pg-player-* owner would fail the submit check).
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        window.location.href = authUrl
    }, [])

    const logout = useCallback(() => {
        clearToken()
        setUser(null)
    }, [])

    const setDisplayName = useCallback(async (name: string) => {
        const { displayName } = await apiUpdateDisplayName(name)
        setUser((u) => (u ? { ...u, displayName } : u))
    }, [])

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, setDisplayName }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook for the provider
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return ctx
}
