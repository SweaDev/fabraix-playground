/**
 * Platform context.
 *
 * Loads the shared state every view needs exactly once at the shell level: the
 * active challenge (the LATEST in the library, matching the old single-page
 * logic, with DEFAULT_CHALLENGE_ID as a fallback), its full detail, and — when
 * logged in — the player's approved-breaks-this-week counter for the sidebar.
 *
 * Rules / Chat / Leaderboard / Sidebar all read from here so they agree on which
 * challenge is active without each refetching.
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
    fetchChallenges,
    fetchChallenge,
    fetchModels,
    fetchMySummary,
    type ModelOption,
} from '@/api'
import { DEFAULT_CHALLENGE_ID } from '@/constants'
import { useAuth } from '@/context/auth'
import type { Challenge, ChallengeListItem } from '@/types'

const VARIANT_STORAGE_KEY = 'pg_variant'

interface PlatformContextValue {
    /** The active challenge's full detail, or null while loading / on error. */
    challenge: Challenge | null
    /** Every challenge in the library (for future selection UI). */
    challenges: ChallengeListItem[]
    /** The active challenge slug (id) — always resolvable, even before detail loads. */
    activeChallengeId: string
    /** True while the initial challenge load is in flight. */
    isLoading: boolean
    /** Set when the challenge load failed. */
    error: string | null
    /** Approved breaks this week for the logged-in player (null when anonymous / unloaded). */
    weeklyBreaks: number | null
    /** Re-pull the weekly-breaks counter (e.g. after a fresh submission). */
    refreshSummary: () => void
    /** The pickable models (opaque names), [] until loaded / when none exist. */
    models: ModelOption[]
    /** The player's chosen model variant (undefined = server default). Shared by
     *  the rail picker, the chat-header picker, and the game itself. */
    variantId: string | undefined
    /** Choose a model (persisted per browser); the chat restarts onto it. */
    setVariantId: (variantId: string | undefined) => void
}

const PlatformContext = createContext<PlatformContextValue | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()

    const [challenge, setChallenge] = useState<Challenge | null>(null)
    const [challenges, setChallenges] = useState<ChallengeListItem[]>([])
    const [activeChallengeId, setActiveChallengeId] = useState<string>(DEFAULT_CHALLENGE_ID)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [weeklyBreaks, setWeeklyBreaks] = useState<number | null>(null)
    const [models, setModels] = useState<ModelOption[]>([])
    const [variantId, setVariantIdState] = useState<string | undefined>(() => {
        try {
            return localStorage.getItem(VARIANT_STORAGE_KEY) ?? undefined
        } catch {
            return undefined
        }
    })

    const setVariantId = useCallback((next: string | undefined) => {
        setVariantIdState(next)
        try {
            if (next) {
                localStorage.setItem(VARIANT_STORAGE_KEY, next)
            } else {
                localStorage.removeItem(VARIANT_STORAGE_KEY)
            }
        } catch {
            /* storage may be unavailable — the in-memory choice still applies */
        }
    }, [])

    // Model catalog loads once. Every session faces a concrete model — there's no
    // "random"/server-default option — so resolve the choice to a real variant:
    // keep a still-valid persisted pick, otherwise default to the first model.
    // (When no models are configured at all, the picker hides and sessions fall
    // through to the server default; variantId stays undefined.)
    useEffect(() => {
        let cancelled = false
        fetchModels()
            .then((m) => {
                if (cancelled) return
                setModels(m)
                if (m.length === 0) return
                let saved: string | null = null
                try { saved = localStorage.getItem(VARIANT_STORAGE_KEY) } catch { /* ignore */ }
                const next = saved && m.some((opt) => opt.id === saved) ? saved : m[0].id
                setVariantId(next)
            })
            .catch(() => { if (!cancelled) setModels([]) })
        return () => { cancelled = true }
    }, [setVariantId])

    useEffect(() => {
        let cancelled = false

        async function load() {
            setIsLoading(true)
            setError(null)
            try {
                const list = await fetchChallenges()
                // The latest challenge is the active one (mirrors the old page).
                const id = list[list.length - 1]?.id || DEFAULT_CHALLENGE_ID
                const detail = await fetchChallenge(id)
                if (cancelled) return
                setChallenges(list)
                setActiveChallengeId(id)
                setChallenge(detail)
            } catch (err) {
                if (cancelled) return
                console.error('Failed to load platform data:', err)
                setError('Failed to load the playground. Please refresh the page.')
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [])

    const refreshSummary = useCallback(() => {
        if (!user || !activeChallengeId) {
            setWeeklyBreaks(null)
            return
        }
        // The sidebar counter is the player's breaks in THIS challenge's prize window,
        // matching that challenge's board.
        fetchMySummary(activeChallengeId)
            .then((s) => setWeeklyBreaks(s.weeklyBreaks))
            .catch(() => setWeeklyBreaks(null))
    }, [user, activeChallengeId])

    // Keep the breaks counter in sync with login state.
    useEffect(() => {
        refreshSummary()
    }, [refreshSummary])

    return (
        <PlatformContext.Provider
            value={{
                challenge,
                challenges,
                activeChallengeId,
                isLoading,
                error,
                weeklyBreaks,
                refreshSummary,
                models,
                variantId,
                setVariantId,
            }}
        >
            {children}
        </PlatformContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook for the provider
export function usePlatform(): PlatformContextValue {
    const ctx = useContext(PlatformContext)
    if (!ctx) {
        throw new Error('usePlatform must be used within a PlatformProvider')
    }
    return ctx
}
