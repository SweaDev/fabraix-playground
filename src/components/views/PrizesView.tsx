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
                        <div className="pg-prize-hero-amount">{prize ?? '—'}</div>
                        <div className="pg-prize-hero-note">This week's prize</div>
                    </div>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>How to win</h2>
                    </div>
                    <p className="pg-panel-body">
                        Whoever logs the <strong>most approved breaks</strong> during the week takes
                        the prize. Every break you land while logged in is submitted for review; each
                        approved break adds to your count.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>The week</h2>
                    </div>
                    <p className="pg-panel-body">
                        Weeks run Tuesday to Monday in UTC, ending at midnight Monday night UTC.
                        Breaks approved within that window count toward that week's board.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Ties</h2>
                    </div>
                    <p className="pg-panel-body">
                        If two players finish the week tied on approved breaks, the one who reached
                        that count first wins.
                    </p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Review &amp; payout</h2>
                    </div>
                    <p className="pg-panel-body">
                        Breaks are reviewed by staff before they count — this keeps the board fair.
                        Winners are chosen and paid out manually after each week closes. You must be
                        signed in when you solve for a break to be eligible.
                    </p>
                </section>
            </div>
        </div>
    )
}
