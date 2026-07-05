/**
 * Challenge-related types
 */

/**
 * Difficulty levels (1-5 stars)
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5

/**
 * Challenge configuration from API
 */
export interface Challenge {
    id: string
    name: string
    difficulty: Difficulty
    description: string
    objective: string
    agentPersona: string
    agentSubtitle: string
    systemPrompt: string
    greeting: string
    deadline?: string
}

/**
 * Challenge list item
 */
export interface ChallengeListItem {
    id: string
    name: string
    difficulty: Difficulty
    locked: boolean
    comingSoon?: boolean
}
