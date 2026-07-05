import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
    fetchWeeklyLeaderboard,
    fetchModelLeaderboard,
    type WeeklyLeaderboard,
    type ModelBoardEntry,
} from '@/api'
import { usePlatform } from '@/context/platform'

const fmtWeek = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const fmtRate = (rate: number) => `${(rate * 100).toFixed(1)}%`

type BoardTab = 'players' | 'models'

/**
 * Standings, in two boards: Players — this week's prize race, ranked by MOST
 * approved breaks (submissions are reviewed before they appear) — and Models —
 * the all-time attack success rate against each (opaquely named) model.
 */
export function LeaderboardView() {
    const { activeChallengeId } = usePlatform()
    const [tab, setTab] = useState<BoardTab>('players')

    const [board, setBoard] = useState<WeeklyLeaderboard | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [modelBoard, setModelBoard] = useState<ModelBoardEntry[] | null>(null)

    useEffect(() => {
        if (!activeChallengeId) return
        let cancelled = false
        setIsLoading(true)
        fetchWeeklyLeaderboard(activeChallengeId)
            .then((b) => { if (!cancelled) setBoard(b) })
            .catch(() => { if (!cancelled) setBoard(null) })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [activeChallengeId])

    // The model board loads lazily on first switch to its tab.
    useEffect(() => {
        if (tab !== 'models' || modelBoard !== null || !activeChallengeId) return
        let cancelled = false
        fetchModelLeaderboard(activeChallengeId)
            .then((b) => { if (!cancelled) setModelBoard(b.models) })
            .catch(() => { if (!cancelled) setModelBoard([]) })
        return () => { cancelled = true }
    }, [tab, modelBoard, activeChallengeId])

    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">Standings</div>
                    {tab === 'players' ? (
                        <>
                            <h1 className="pg-view-title">This week's breaks</h1>
                            {board && (
                                <p className="pg-view-lede">
                                    {fmtWeek(board.weekStart)} – {fmtWeek(board.weekEnd)} (UTC) · Most approved
                                    breaks this week wins <strong className="pg-accent">{board.prize}</strong>.
                                    Submissions are reviewed before they appear.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <h1 className="pg-view-title">Success rate by model</h1>
                            <p className="pg-view-lede">
                                All-time share of played sessions that ended in a break, per model.
                                Models keep their arena names — pick one to face from the Model
                                selector before you play.
                            </p>
                        </>
                    )}
                </header>

                <div className="pg-seg" role="tablist" aria-label="Standings board">
                    <button
                        role="tab"
                        aria-selected={tab === 'players'}
                        className={`pg-seg-btn${tab === 'players' ? ' pg-seg-active' : ''}`}
                        onClick={() => setTab('players')}
                    >
                        Players
                    </button>
                    <button
                        role="tab"
                        aria-selected={tab === 'models'}
                        className={`pg-seg-btn${tab === 'models' ? ' pg-seg-active' : ''}`}
                        onClick={() => setTab('models')}
                    >
                        Models
                    </button>
                </div>

                {tab === 'players' ? (
                    <section className="pg-panel pg-panel-flush">
                        {isLoading ? (
                            <div className="pg-loading-row">
                                <Loader2 size={22} className="animate-spin" />
                            </div>
                        ) : !board || board.entries.length === 0 ? (
                            <p className="pg-empty">No approved breaks yet this week.</p>
                        ) : (
                            <table className="pg-table">
                                <thead>
                                    <tr>
                                        <th className="pg-th">#</th>
                                        <th className="pg-th">Name</th>
                                        <th className="pg-th pg-th-right">Breaks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {board.entries.map((e) => (
                                        <tr key={`${e.rank}-${e.displayName}`} className="pg-tr">
                                            <td className={`pg-td pg-td-rank${e.rank <= 3 ? ' pg-td-podium' : ''}`}>
                                                {e.rank}
                                            </td>
                                            <td className="pg-td">{e.displayName}</td>
                                            <td className="pg-td pg-td-right pg-mono">{e.breakCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                ) : (
                    <section className="pg-panel pg-panel-flush">
                        {modelBoard === null ? (
                            <div className="pg-loading-row">
                                <Loader2 size={22} className="animate-spin" />
                            </div>
                        ) : modelBoard.length === 0 ? (
                            <p className="pg-empty">No model stats yet — play a few rounds first.</p>
                        ) : (
                            <table className="pg-table">
                                <thead>
                                    <tr>
                                        <th className="pg-th">Model</th>
                                        <th className="pg-th pg-th-right">Attempts</th>
                                        <th className="pg-th pg-th-right">Breaks</th>
                                        <th className="pg-th pg-th-right">Success rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelBoard.map((m) => (
                                        <tr key={m.displayName} className="pg-tr">
                                            <td className="pg-td">{m.displayName}</td>
                                            <td className="pg-td pg-td-right pg-mono">{m.attempts}</td>
                                            <td className="pg-td pg-td-right pg-mono">{m.breaks}</td>
                                            <td className="pg-td pg-td-right pg-mono">{fmtRate(m.successRate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                )}
            </div>
        </div>
    )
}
