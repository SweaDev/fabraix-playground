import { useState, useEffect, useCallback } from 'react'
import { LogIn, User as UserIcon, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/context/auth'
import { useTheme } from '@/context/theme'

/**
 * Top header: FABRAIX wordmark (left) + theme toggle, GitHub link, and the
 * account/login control (right). The primary tab navigation lives directly
 * below in TabNav; the only modal that remains here is the minimal account
 * popover for SETTING the required leaderboard display name.
 */
export function Nav() {
    const { user, isLoading: authLoading, login, logout, setDisplayName } = useAuth()
    const { theme, toggle: toggleTheme } = useTheme()

    const [showAccount, setShowAccount] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [savingName, setSavingName] = useState(false)
    const [nameError, setNameError] = useState<string | null>(null)

    // Prompt for a display name once, right after first login (unchanged behavior).
    useEffect(() => {
        if (user && !user.displayName) {
            setNameInput(user.name ?? '')
            setShowAccount(true)
        }
    }, [user])

    const saveName = useCallback(async () => {
        const trimmed = nameInput.trim()
        if (!trimmed) {
            setNameError('Please enter a display name.')
            return
        }
        setSavingName(true)
        setNameError(null)
        try {
            await setDisplayName(trimmed)
        } catch {
            setNameError('Could not save. Please try again.')
        } finally {
            setSavingName(false)
        }
    }, [nameInput, setDisplayName])

    return (
        <>
            <header className="nav">
                <div className="nav-left">
                    <a href="https://fabraix.com" className="logo">FABRAIX</a>
                </div>
                <div className="nav-right">
                    <button
                        className="nav-icon-btn"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <a
                        href="https://github.com/fabraix/playground"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-icon-btn"
                        aria-label="GitHub"
                        title="GitHub"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                    </a>

                    {/* Account, or the primary CTA = log in */}
                    {authLoading ? null : user ? (
                        <button
                            className={`nav-account${user.displayName ? '' : ' nav-account-unset'}`}
                            onClick={() => setShowAccount(true)}
                        >
                            <UserIcon size={15} />
                            <span className="nav-account-name">
                                {user.displayName ?? 'Set display name'}
                            </span>
                        </button>
                    ) : (
                        <button className="nav-cta" onClick={() => login()}>
                            <LogIn size={15} />
                            Log in
                        </button>
                    )}
                </div>
            </header>

            {/* Account popover: set/update the required leaderboard display name */}
            {showAccount && user && (
                <div className="pg-modal-overlay" onClick={() => setShowAccount(false)}>
                    <div className="pg-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="pg-modal-head">
                            <div className="pg-modal-title">
                                <UserIcon size={20} className="pg-accent" />
                                <h3>Your account</h3>
                            </div>
                            <button
                                className="pg-modal-close"
                                onClick={() => setShowAccount(false)}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="pg-modal-sub">{user.email}</p>

                        <label className="pg-field-label" htmlFor="pg-display-name">
                            Leaderboard display name
                        </label>
                        <div className="pg-field-row">
                            <input
                                id="pg-display-name"
                                className="pg-input"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                maxLength={40}
                                placeholder="Pick a handle (shown publicly)"
                            />
                            <button onClick={saveName} className="nav-cta" disabled={savingName}>
                                {savingName ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                        {nameError && <p className="pg-error">{nameError}</p>}
                        {!user.displayName && (
                            <p className="pg-hint-accent">
                                Set a display name to appear on the leaderboard.
                            </p>
                        )}

                        <div className="pg-modal-foot">
                            <button
                                className="pg-linkbtn"
                                onClick={() => { logout(); setShowAccount(false) }}
                            >
                                Sign out
                            </button>
                            <button className="nav-cta" onClick={() => setShowAccount(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
