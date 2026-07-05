/**
 * Theme context: light (brand default) / dark, toggled from the nav.
 *
 * The actual `.dark` class on <html> is set BEFORE React mounts by the no-flash
 * script in index.html (reads localStorage, else the OS `prefers-color-scheme`),
 * so there's no flash of the wrong theme. This provider just mirrors that initial
 * value into React state and owns the toggle + persistence from here on.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pg_theme'

interface ThemeContextValue {
    theme: Theme
    /** Flip light <-> dark and persist the choice. */
    toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    // Keep the browser chrome (mobile status/URL-bar tint) on-theme too — the
    // meta ships with the light value as the pre-paint default.
    document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#0b0b0d' : '#faf8f2')
}

function persist(theme: Theme): void {
    try {
        localStorage.setItem(STORAGE_KEY, theme)
    } catch {
        /* storage may be unavailable (private mode) — the class still applies */
    }
}

function initialTheme(): Theme {
    // The pre-paint script already resolved and applied the class; read it back so
    // state and DOM agree without re-deriving (and without a second flash).
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(initialTheme)

    // Re-assert on theme changes (idempotent) — this also fixes up the
    // theme-color meta when the pre-paint script resolved to dark.
    useEffect(() => {
        applyTheme(theme)
    }, [theme])

    const toggle = useCallback(() => {
        setTheme((cur) => {
            const next: Theme = cur === 'dark' ? 'light' : 'dark'
            applyTheme(next)
            persist(next)
            return next
        })
    }, [])

    // Follow OS changes only while the player hasn't made an explicit choice.
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = (e: MediaQueryListEvent) => {
            try {
                if (localStorage.getItem(STORAGE_KEY)) return // user chose — respect it
            } catch {
                /* ignore */
            }
            const next: Theme = e.matches ? 'dark' : 'light'
            applyTheme(next)
            setTheme(next)
        }
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook for the provider
export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return ctx
}
