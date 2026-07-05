import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { fetchWeeklyLeaderboard } from '@/api'
import { ModelPicker } from '@/components/challenge'
import { usePlatform } from '@/context/platform'
import { useAuth } from '@/context/auth'

const DIFFICULTY_LABELS: Record<number, string> = {
    1: 'Easy',
    2: 'Moderate',
    3: 'Hard',
    4: 'Expert',
    5: 'Insane',
}

/**
 * Left rail giving the current challenge real presence (challenge name, persona,
 * difficulty, the weekly prize, and the player's weekly breaks) — the arena's
 * anchor. Styled in the restrained Fabraix language: thin dividers, ink text,
 * accent used only as a whisper, one near-black CTA.
 */
export function ChallengeRail() {
    const { challenge, activeChallengeId, weeklyBreaks } = usePlatform()
    const { user } = useAuth()
    const [prize, setPrize] = useState<string | null>(null)

    useEffect(() => {
        if (!activeChallengeId) return
        let cancelled = false
        fetchWeeklyLeaderboard(activeChallengeId)
            .then((b) => { if (!cancelled) setPrize(b.prize) })
            .catch(() => { if (!cancelled) setPrize(null) })
        return () => { cancelled = true }
    }, [activeChallengeId])

    if (!challenge) return <aside className="pg-rail" aria-label="Current challenge" />

    const difficulty =
        DIFFICULTY_LABELS[challenge.difficulty] ?? `Level ${challenge.difficulty}`

    return (
        <aside className="pg-rail" aria-label="Current challenge">
            {/* Phone face: a slim context strip (name · difficulty · prize + the
                sign-in nudge / weekly tally) linking to the full briefing. */}
            <Link to="/" className="pg-rail-mobile">
                <div className="pg-rail-mobile-row">
                    <span className="pg-rail-mobile-name">{challenge.name}</span>
                    <span className={`pg-rail-difficulty pg-difficulty-${challenge.difficulty}`}>
                        {difficulty}
                    </span>
                    <span className="pg-rail-mobile-prize">{prize ?? '—'}</span>
                </div>
                <div className="pg-rail-mobile-sub">
                    {user
                        ? `${weeklyBreaks ?? 0} breaks this week · most approved breaks wins`
                        : 'Sign in before you solve to compete for the weekly prize'}
                    <ChevronRight size={13} />
                </div>
            </Link>

            <div className="pg-rail-inner">
                <div className="pg-rail-eyebrow">Current challenge</div>
                <h1 className="pg-rail-title">{challenge.name}</h1>
                <p className="pg-rail-persona">
                    {challenge.agentPersona} · {challenge.agentSubtitle}
                </p>

                <span className={`pg-rail-difficulty pg-difficulty-${challenge.difficulty}`}>
                    {difficulty}
                </span>

                <p className="pg-rail-desc">{challenge.description}</p>

                <div className="pg-rail-model">
                    <ModelPicker />
                </div>

                <Link to="/chat" className="pg-rail-cta">
                    Start playing
                    <ArrowRight size={15} />
                </Link>

                <div className="pg-rail-divider" />

                <div className="pg-rail-block">
                    <div className="pg-rail-label">This week&rsquo;s prize</div>
                    <div className="pg-rail-figure">{prize ?? '—'}</div>
                    <div className="pg-rail-sub">Most approved breaks wins.</div>
                </div>

                <div className="pg-rail-divider" />

                {user ? (
                    <div className="pg-rail-block">
                        <div className="pg-rail-label">Your breaks this week</div>
                        <div className="pg-rail-figure pg-mono">{weeklyBreaks ?? 0}</div>
                    </div>
                ) : (
                    <div className="pg-rail-block">
                        <div className="pg-rail-sub">
                            Sign in before you solve to compete for the weekly prize.
                        </div>
                    </div>
                )}
            </div>
        </aside>
    )
}
