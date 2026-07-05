/**
 * Session and persistence types
 */

import type { SerializedMessage } from './message.types'
import type { AnalysisStatus } from './analysis.types'

/**
 * Session start response from API
 */
export interface SessionStartResponse {
    sessionId: string
    guardrailsRunId: string
    challenge: {
        id: string
        name: string
        agentPersona: string
        agentSubtitle: string
    }
    greeting: string
}

/**
 * Session restart response from API
 */
export interface SessionRestartResponse {
    sessionId: string
    guardrailsRunId: string
    greeting: string
}

/**
 * Session data for persistence
 */
export interface SessionData {
    sessionId: string
    messages: SerializedMessage[]
    attempts: number
    startTime: string
    elapsedTime: number
    status: AnalysisStatus
    reason: string
    hasWon?: boolean
    /** The model variant the session runs against (undefined = server default).
     *  A saved session is only restored when it matches the current choice. */
    variantId?: string
}
