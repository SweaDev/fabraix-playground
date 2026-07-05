/**
 * Analysis-related types
 */

/**
 * Analysis status
 */
export type AnalysisStatus = 'pending' | 'safe' | 'blocked'

/**
 * Tool call from API response
 */
export interface ToolCall {
    name: string
    arguments: Record<string, unknown>
    result: string | null
    blocked: boolean
    reasoning: string | null
}
