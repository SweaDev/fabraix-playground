/**
 * Hook for managing the per-message guardrail verdict: status + reason.
 *
 * The static "active guardrails" list was retired with the SAFE-panel shrink, so
 * this now tracks only the one thing the panel renders — did the guardrail hold
 * (`status`) and why (`reason`).
 */

import { useState, useCallback } from 'react'
import type { AnalysisStatus } from '@/types'

interface UseAnalysisReturn {
    status: AnalysisStatus
    reason: string
    updateAnalysis: (newStatus: AnalysisStatus, newReason: string) => void
    resetAnalysis: () => void
    setStatus: React.Dispatch<React.SetStateAction<AnalysisStatus>>
    setReason: React.Dispatch<React.SetStateAction<string>>
}

export function useAnalysis(): UseAnalysisReturn {
    const [status, setStatus] = useState<AnalysisStatus>('pending')
    const [reason, setReason] = useState('')

    const updateAnalysis = useCallback((newStatus: AnalysisStatus, newReason: string): void => {
        setStatus(newStatus)
        setReason(newReason)
    }, [])

    const resetAnalysis = useCallback(() => {
        setStatus('pending')
        setReason('')
    }, [])

    return {
        status,
        reason,
        updateAnalysis,
        resetAnalysis,
        setStatus,
        setReason,
    }
}
