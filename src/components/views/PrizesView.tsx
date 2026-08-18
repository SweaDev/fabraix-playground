import { useEffect, useState } from 'react'
import { fetchWeeklyLeaderboard } from '@/api'
import { usePlatform } from '@/context/platform'

/**
 * How winning works: the weekly prize, the most-approved-breaks rule, tie-break,
 * and the manual review + payout policy. Derived from the weekly board's prize.
 */
export function PrizesView() {
    const { activeChallengeId } = usePlatform()
    const [prize, setPrize] = useState<string | null>(null)

    useEffect(() => {
        if (!activeChallengeId) return
        let cancelled = false
        fetchWeeklyLeaderboard(activeChallengeId)
            .then((b) => { if (!cancelled) setPrize(b.prize) })
            .catch(() => { if (!cancelled) setPrize(null) })
        return () => { cancelled = true }
    }, [activeChallengeId])

    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">
                        Rewards
                    </div>
                    <h1 className="pg-view-title">Win the week</h1>
                </header>

                <section className="pg-panel pg-prize-hero">
                    <div>
                        <div className="pg-prize-hero-amount">{prize ?? '–'}</div>
                        <div className="pg-prize-hero-note">This week's prize</div>
                    </div>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>How to win</h2>
                    </div>
                    <p className="pg-panel-body">
                        Whoever logs the <strong>most approved breaks</strong> in a week wins.
                        Every break you land while signed in goes to review, and each approved
                        one adds to your count.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>The week</h2>
                    </div>
                    <p className="pg-panel-body">
                        A week runs Thursday to Wednesday UTC. Breaks approved in that window count
                        toward that week's board.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Ties</h2>
                    </div>
                    <p className="pg-panel-body">
                        On a tie, whoever reached the count first wins.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Review &amp; payout</h2>
                    </div>
                    <p className="pg-panel-body">
                        Staff review every break before it counts, which keeps the board fair.
                        Winners are picked and paid out manually after the week closes. Sign in when
                        you solve to be eligible.
                    </p>
                </section>
            </div>
        </div>
    )
}
