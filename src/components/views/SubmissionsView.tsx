import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
    fetchMySubmissions,
    type Submission,
    type ReviewStatus,
} from '@/api'
import { useAuth } from '@/context/auth'
import { LoginGate } from './LoginGate'

const STATUS_LABEL: Record<ReviewStatus, string> = {
    pending: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
}

const STATUS_CLASS: Record<ReviewStatus, string> = {
    pending: 'pg-badge-pending',
    approved: 'pg-badge-approved',
    rejected: 'pg-badge-rejected',
}

const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * The player's own leaderboard submissions and where each stands in review.
 * A break only counts toward the weekly prize once it's approved. Login-gated.
 */
export function SubmissionsView() {
    const { user, isLoading: isAuthLoading } = useAuth()
    const [subs, setSubs] = useState<Submission[] | null>(null)

    useEffect(() => {
        if (!user) return
        let cancelled = false
        fetchMySubmissions()
            .then((s) => { if (!cancelled) setSubs(s) })
            .catch(() => { if (!cancelled) setSubs([]) })
        return () => { cancelled = true }
    }, [user])

    if (isAuthLoading) {
        return <div className="pg-view pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
    }

    if (!user) {
        return (
            <div className="pg-view pg-view-scroll">
                <LoginGate
                    title="Sign in to see your submissions"
                    message="Track the review status of every break you've submitted for the weekly prize."
                />
            </div>
        )
    }

    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">
                        Submissions
                    </div>
                    <h1 className="pg-view-title">Your submitted breaks</h1>
                    <p className="pg-view-lede">
                        Every break is reviewed by staff before it counts toward the weekly prize.
                    </p>
                </header>

                <section className="pg-panel pg-panel-flush">
                    {subs === null ? (
                        <div className="pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
                    ) : subs.length === 0 ? (
                        <p className="pg-empty">No submissions yet — solve a challenge while logged in to submit one.</p>
                    ) : (
                        <ul className="pg-rows">
                            {subs.map((s) => (
                                <li key={s.id}>
                                    <div className="pg-row pg-row-static">
                                        <div className="pg-row-main">
                                            <span className="pg-row-title">{s.challengeSlug}</span>
                                            <span className="pg-row-sub">
                                                Solved in {fmtTime(s.timeSeconds)}
                                                {s.modelName && ` · vs ${s.modelName}`}
                                                {' · '}{fmtDate(s.solvedAt ?? s.createdAt)}
                                            </span>
                                            {s.reviewStatus === 'rejected' && s.rejectionReason && (
                                                <span className="pg-row-reason">Reason: {s.rejectionReason}</span>
                                            )}
                                        </div>
                                        <div className="pg-row-side">
                                            <span className={`pg-badge ${STATUS_CLASS[s.reviewStatus]}`}>
                                                {STATUS_LABEL[s.reviewStatus]}
                                            </span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}
