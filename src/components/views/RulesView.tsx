import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { usePlatform } from '@/context/platform'

const DIFFICULTY_LABELS: Record<number, string> = {
    1: 'Easy',
    2: 'Moderate',
    3: 'Hard',
    4: 'Expert',
    5: 'Insane',
}

/**
 * Rules / briefing for the active challenge: who the defender is, the objective,
 * how it works, and the defender's (publicly served) system prompt. Entry point
 * into /chat.
 */
export function RulesView() {
    const { challenge } = usePlatform()
    const [showPrompt, setShowPrompt] = useState(false)

    if (!challenge) return null

    const challengeNumber = challenge.id.match(/(\d+)$/)?.[1] || '001'

    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">
                        Challenge #{challengeNumber} · Difficulty {challenge.difficulty}/5
                        {' · '}{DIFFICULTY_LABELS[challenge.difficulty] ?? ''}
                    </div>
                    <h1 className="pg-view-title">{challenge.name}</h1>
                    <p className="pg-view-lede">{challenge.agentSubtitle || challenge.agentPersona}</p>
                </header>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Objective</h2>
                    </div>
                    <p className="pg-panel-body">{challenge.objective}</p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>Briefing</h2>
                    </div>
                    <p className="pg-panel-body">{challenge.description}</p>
                </section>

                <section className="pg-panel">
                    <div className="pg-panel-head">
                        <h2>How it works</h2>
                    </div>
                    <ul className="pg-list">
                        <li>You're chatting with <strong>{challenge.agentPersona}</strong>, an AI agent guarded by a defender.</li>
                        <li>Use prompt injection, social engineering, or clever framing to make it break its rules.</li>
                        <li>Every message is scored by a guardrail. Achieving the objective ends the round with a win.</li>
                        <li>Sign in before you solve so your break can be submitted for the weekly prize.</li>
                        <li>A win is <strong>submitted for review</strong>. It lands on the leaderboard once staff approve it.</li>
                    </ul>
                </section>

                <section className="pg-panel">
                    <button
                        className="pg-collapse-toggle"
                        onClick={() => setShowPrompt((s) => !s)}
                        aria-expanded={showPrompt}
                    >
                        {showPrompt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Defender system prompt
                    </button>
                    {showPrompt && (
                        <pre className="pg-code-block">{challenge.systemPrompt}</pre>
                    )}
                </section>

                <div className="pg-cta-row">
                    <Link to="/chat" className="pg-btn-primary">
                        Start playing
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    )
}
