import { RotateCcw, Loader2 } from 'lucide-react'
import type { Challenge } from '@/types'
import { ModelPicker } from './ModelPicker'

interface ChallengeHeaderProps {
    challenge: Challenge
    attempts: number
    elapsedTime: string
    onRestart?: () => void
    isRestarting?: boolean
}

/**
 * Compact header showing current challenge info + the run stats (messages,
 * elapsed) and the Restart action beneath them. On phones the stats fold away
 * and the header carries the play controls instead: the model picker (the
 * sidebar hosts it on desktop) and Restart, which must stay reachable mid-run.
 */
export function ChallengeHeader({
    challenge,
    attempts,
    elapsedTime,
    onRestart,
    isRestarting,
}: ChallengeHeaderProps) {
    // Extract number from slug (e.g. "access-code-001" → "001")
    const challengeNumber = challenge.id.match(/(\d+)$/)?.[1] || '001'

    return (
        <header className="challenge-header">
            <div className="challenge-info">
                <div className="challenge-label">
                    <span className="challenge-badge">Challenge #{challengeNumber}</span>
                    <span className="challenge-label-sep">·</span>
                    <span>Difficulty {challenge.difficulty}/5</span>
                </div>
                <h1 className="challenge-title">{challenge.name}</h1>
                <p className="challenge-objective">{challenge.objective}</p>
            </div>

            <div className="challenge-meta">
                <div className="challenge-stats">
                    <div className="challenge-stat">
                        <div className="challenge-stat-value">{attempts}</div>
                        <div className="challenge-stat-label">Messages</div>
                    </div>
                    <div className="challenge-stat">
                        <div className="challenge-stat-value">{elapsedTime}</div>
                        <div className="challenge-stat-label">Elapsed</div>
                    </div>
                </div>
                <ModelPicker disabled={isRestarting} />
                {onRestart && (
                    <button
                        className="pg-restart-btn"
                        onClick={onRestart}
                        disabled={isRestarting}
                        title="Restart conversation"
                    >
                        {isRestarting
                            ? <Loader2 size={14} className="animate-spin" />
                            : <RotateCcw size={14} />}
                        Restart
                    </button>
                )}
            </div>
        </header>
    )
}
