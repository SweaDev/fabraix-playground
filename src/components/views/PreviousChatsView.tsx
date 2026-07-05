import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import {
    fetchMySolves,
    fetchSessionMessages,
    type MySolve,
    type SessionTranscript,
} from '@/api'
import { useAuth } from '@/context/auth'
import { LoginGate } from './LoginGate'

const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const fmtTime = (s: number | null) =>
    s != null ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—'

/**
 * The player's own sessions (newest first). Clicking one replays its transcript
 * via the owner-scoped messages endpoint. Login-gated.
 */
export function PreviousChatsView() {
    const { user, isLoading: isAuthLoading } = useAuth()

    const [solves, setSolves] = useState<MySolve[] | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<SessionTranscript | null>(null)
    const [loadingTranscript, setLoadingTranscript] = useState(false)

    useEffect(() => {
        if (!user) return
        let cancelled = false
        fetchMySolves()
            .then((s) => { if (!cancelled) setSolves(s) })
            .catch(() => { if (!cancelled) setSolves([]) })
        return () => { cancelled = true }
    }, [user])

    useEffect(() => {
        if (!selected) {
            setTranscript(null)
            return
        }
        let cancelled = false
        setLoadingTranscript(true)
        setTranscript(null)
        fetchSessionMessages(selected)
            .then((t) => { if (!cancelled) setTranscript(t) })
            .catch(() => { if (!cancelled) setTranscript(null) })
            .finally(() => { if (!cancelled) setLoadingTranscript(false) })
        return () => { cancelled = true }
    }, [selected])

    if (isAuthLoading) {
        return <div className="pg-view pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
    }

    if (!user) {
        return (
            <div className="pg-view pg-view-scroll">
                <LoginGate
                    title="Sign in to see your past chats"
                    message="Your previous sessions and transcripts are tied to your account."
                />
            </div>
        )
    }

    // Transcript replay
    if (selected) {
        return (
            <div className="pg-view pg-view-scroll">
                <div className="pg-view-inner">
                    <button className="pg-back" onClick={() => setSelected(null)}>
                        <ArrowLeft size={14} />
                        Back to your chats
                    </button>
                    {loadingTranscript ? (
                        <div className="pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
                    ) : !transcript ? (
                        <p className="pg-empty">Couldn't load this transcript.</p>
                    ) : (
                        <>
                            <header className="pg-view-header">
                                <div className="pg-view-eyebrow">
                                    {transcript.challengeSlug}
                                    {transcript.solved && (
                                        <span className="pg-badge pg-badge-approved">
                                            Solved
                                        </span>
                                    )}
                                </div>
                                <h1 className="pg-view-title">Transcript</h1>
                            </header>
                            <div className="pg-transcript">
                                {transcript.messages.map((m, i) => (
                                    <div key={i} className={`pg-transcript-msg pg-transcript-${m.role}`}>
                                        <div className="pg-transcript-role">{m.role}</div>
                                        <div className="pg-transcript-content">{m.content}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Solves list
    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">
                        History
                    </div>
                    <h1 className="pg-view-title">Your sessions</h1>
                    <p className="pg-view-lede">Every session you've played, newest first. Open one to replay it.</p>
                </header>

                <section className="pg-panel pg-panel-flush">
                    {solves === null ? (
                        <div className="pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
                    ) : solves.length === 0 ? (
                        <p className="pg-empty">No sessions yet — head to Chat to start a run.</p>
                    ) : (
                        <ul className="pg-rows">
                            {solves.map((s) => (
                                <li key={s.sessionId}>
                                    <button className="pg-row" onClick={() => setSelected(s.sessionId)}>
                                        <div className="pg-row-main">
                                            <span className="pg-row-title">{s.challengeSlug}</span>
                                            <span className="pg-row-sub">
                                                {fmtDate(s.createdAt)}
                                                {s.messageCount != null && ` · ${s.messageCount} messages`}
                                            </span>
                                        </div>
                                        <div className="pg-row-side">
                                            {s.solved ? (
                                                <span className="pg-badge pg-badge-approved">
                                                    Solved · {fmtTime(s.timeSeconds)}
                                                </span>
                                            ) : (
                                                <span className="pg-badge pg-badge-neutral">In progress</span>
                                            )}
                                            <ChevronRight size={16} className="pg-muted" />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}
