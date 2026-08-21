import { useState, useEffect, useRef, useCallback } from 'react'
import { Trophy, X } from 'lucide-react'
import {
    ChallengeHeader,
    ChatPanel,
} from '@/components/challenge'
import { useChallengeGame } from '@/hooks'
import { submitLeaderboard } from '@/api'
import { DEFAULT_CHALLENGE_ID } from '@/constants'
import { usePlatform } from '@/context/platform'
import { useAuth } from '@/context/auth'

type WinState =
    | 'idle'
    | 'submitting'
    | 'submitted'
    | 'submit_failed'

/**
 * The play surface: challenge header + streaming chat. The model picker lives in
 * the sidebar (desktop) / header (mobile) and writes the shared variant choice;
 * this view restarts the live session whenever that choice changes.
 *
 * A win opens a confirmation dialog - the break is only submitted for review
 * when the player explicitly asks for it (no background auto-submit). Players
 * who can't submit (anonymous, or no display name yet) get told why instead.
 */
export function ChatView() {
    const { challenge, refreshSummary, variantId } = usePlatform()
    const { user, isLoading: isAuthLoading } = useAuth()

    const game = useChallengeGame({
        challengeId: challenge?.id || DEFAULT_CHALLENGE_ID,
        variantId,
    })

    // Restart onto the newly-picked model when the shared choice changes while
    // this view is mounted (initial mount just records the starting value -
    // useChallengeGame already started/restored the session on it).
    const appliedVariantRef = useRef(variantId)
    const changeVariant = game.changeVariant
    useEffect(() => {
        if (appliedVariantRef.current === variantId) return
        appliedVariantRef.current = variantId
        changeVariant(variantId)
    }, [variantId, changeVariant])

    const [winState, setWinState] = useState<WinState>('idle')
    const [showWinDialog, setShowWinDialog] = useState(false)
    // One dialog per solved session - reopening is only possible via a new win.
    const winDialogSessionRef = useRef<string | null>(null)

    useEffect(() => {
        if (!game.hasWon || !game.sessionId) {
            setWinState('idle')
            setShowWinDialog(false)
            winDialogSessionRef.current = null
            return
        }
        // Hold the dialog until auth resolves so a reloaded solved session doesn't
        // briefly show the "not logged in" copy before /auth/me returns.
        if (isAuthLoading) return
        if (winDialogSessionRef.current !== game.sessionId) {
            winDialogSessionRef.current = game.sessionId
            setShowWinDialog(true)
        }
    }, [game.hasWon, game.sessionId, isAuthLoading])

    const submitBreak = useCallback(async () => {
        if (!game.sessionId) return
        setWinState('submitting')
        try {
            await submitLeaderboard(game.sessionId)
            setWinState('submitted')
            // A fresh approval could bump the context counter later; refresh now.
            refreshSummary()
        } catch {
            setWinState('submit_failed')
        }
    }, [game.sessionId, refreshSummary])

    const canSubmit = !!user && !!user.displayName
    const solvedIn = game.formatTime(game.elapsedTime)

    const winBannerText =
        winState === 'submitted'
            ? `Solved in ${solvedIn}. Your break was submitted for review, and appears on Standings once approved.`
            : winState === 'submit_failed'
                ? "We couldn't submit this break. Reopen a run and solve again while signed in to submit it."
                : ''

    if (!challenge) return null

    return (
        <div className="pg-chat-view">
            <ChallengeHeader
                challenge={challenge}
                attempts={game.attempts}
                elapsedTime={solvedIn}
                onRestart={game.resetGame}
                isRestarting={game.isRestarting}
            />

            {winBannerText && !showWinDialog && (
                <div role="status" className="pg-win-banner">
                    {winBannerText}
                </div>
            )}

            <ChatPanel
                agentName={challenge.agentPersona}
                messages={game.messages}
                inputValue={game.inputValue}
                onInputChange={game.setInputValue}
                onKeyDown={game.handleKeyDown}
                onSubmit={game.sendMessage}
                isLoading={game.isLoading || game.isInitializing}
                isEnded={game.sessionEnded}
                inputRef={game.inputRef}
                currentStatus={game.currentStatus}
                steps={game.steps}
            />

            {showWinDialog && (
                <div className="pg-modal-overlay" onClick={() => setShowWinDialog(false)}>
                    <div
                        className="pg-modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pg-win-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="pg-modal-head">
                            <div className="pg-modal-title">
                                <Trophy size={20} className="pg-accent" />
                                <h3 id="pg-win-title">You broke {challenge.agentPersona}</h3>
                            </div>
                            <button
                                className="pg-modal-close"
                                onClick={() => setShowWinDialog(false)}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {winState === 'submitted' ? (
                            <>
                                <p className="pg-modal-sub">
                                    Submitted for review. Your break appears on Standings once
                                    staff approve it.
                                </p>
                                <div className="pg-modal-actions">
                                    <button className="nav-cta" onClick={() => setShowWinDialog(false)}>
                                        Done
                                    </button>
                                </div>
                            </>
                        ) : canSubmit ? (
                            <>
                                <p className="pg-modal-sub">
                                    Solved in {solvedIn}. Submit this conversation for review to
                                    count it toward the weekly prize?
                                </p>
                                {winState === 'submit_failed' && (
                                    <p className="pg-error">Submission failed. Try again.</p>
                                )}
                                <div className="pg-modal-actions">
                                    <button
                                        className="pg-linkbtn"
                                        onClick={() => setShowWinDialog(false)}
                                    >
                                        Not now
                                    </button>
                                    <button
                                        className="nav-cta"
                                        onClick={submitBreak}
                                        disabled={winState === 'submitting'}
                                    >
                                        {winState === 'submitting' ? 'Submitting…' : 'Submit for review'}
                                    </button>
                                </div>
                            </>
                        ) : user ? (
                            <>
                                <p className="pg-modal-sub">
                                    Solved in {solvedIn}. Set your display name (top right) so this
                                    break can be submitted for review.
                                </p>
                                <div className="pg-modal-actions">
                                    <button className="nav-cta" onClick={() => setShowWinDialog(false)}>
                                        Close
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="pg-modal-sub">
                                    Solved in {solvedIn}, but you weren't signed in, so this break
                                    can't be submitted for the weekly prize. Sign in before solving
                                    to be eligible.
                                </p>
                                <div className="pg-modal-actions">
                                    <button className="nav-cta" onClick={() => setShowWinDialog(false)}>
                                        Close
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
