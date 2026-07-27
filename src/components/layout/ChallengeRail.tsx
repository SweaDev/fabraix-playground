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

/** Live "1d 22h 04m 31s" countdown until the prize week resets. */
function formatTimeLeft(weekEnd: string, now: number): string | null {
    const ms = new Date(weekEnd).getTime() - now
    if (!Number.isFinite(ms) || ms <= 0) return null
    const total = Math.floor(ms / 1_000)
    const days = Math.floor(total / 86_400)
    const hours = Math.floor((total % 86_400) / 3_600)
    const minutes = Math.floor((total % 3_600) / 60)
    const seconds = total % 60
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    if (days > 0) return `${days}d ${hours}h ${mm}m ${ss}s`
    if (hours > 0) return `${hours}h ${mm}m ${ss}s`
    return `${minutes}m ${ss}s`
}

/** Absolute end moment in UTC — the canonical deadline, e.g. "Thu 30 Jul, 00:00 UTC". */
function formatEndDate(weekEnd: string): string {
    const d = new Date(weekEnd)
    if (Number.isNaN(d.getTime())) return ''
    const s = d.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
    })
    return `${s} UTC`
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
    const [weekEnd, setWeekEnd] = useState<string | null>(null)
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!activeChallengeId) return
        let cancelled = false
        fetchWeeklyLeaderboard(activeChallengeId)
            .then((b) => {
                if (cancelled) return
                setPrize(b.prize)
                setWeekEnd(b.weekEnd)
            })
            .catch(() => {
                if (cancelled) return
                setPrize(null)
                setWeekEnd(null)
            })
        return () => { cancelled = true }
    }, [activeChallengeId])

    useEffect(() => {
        if (!weekEnd) return
        const t = setInterval(() => setNow(Date.now()), 1_000)
        return () => clearInterval(t)
    }, [weekEnd])

    const timeLeft = weekEnd ? formatTimeLeft(weekEnd, now) : null

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
                    <div className="pg-rail-label">This challenge&rsquo;s prize</div>
                    <div className="pg-rail-figure">{prize ?? '—'}</div>
                    <div className="pg-rail-sub">Most approved breaks wins.</div>
                    <div className="pg-rail-note">
                        Harder challenges are weighted more. The order challenges appear in isn&rsquo;t their difficulty.
                    </div>
                    {timeLeft && weekEnd && (
                        <>
                            <div className="pg-rail-label pg-rail-countdown-label">Challenge ends in</div>
                            <div className="pg-rail-countdown pg-mono">{timeLeft}</div>
                            <div className="pg-rail-sub">{formatEndDate(weekEnd)}</div>
                        </>
                    )}
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
