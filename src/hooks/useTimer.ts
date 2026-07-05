import { useState, useEffect, useCallback, useRef } from 'react'
import { formatTime } from '@/utils'

interface UseTimerOptions {
    /** Initial elapsed time in seconds */
    initialElapsed?: number
    /** Whether the timer should be running */
    isRunning?: boolean
}

interface UseTimerReturn {
    /** Elapsed time in seconds */
    elapsedTime: number
    /** Start time reference */
    startTime: Date | null
    /** Start or resume the timer */
    start: (fromTime?: Date) => void
    /** Stop the timer */
    stop: () => void
    /** Rehydrate from persisted state: resume live when running, or hold a frozen
     *  elapsed value (e.g. a session that was already solved before reload). */
    restore: (elapsed: number, fromTime: Date, isRunning: boolean) => void
    /** Reset the timer */
    reset: () => void
    /** Format seconds to MM:SS */
    formatTime: (seconds: number) => string
}

/**
 * Hook for managing elapsed time with start/stop/reset controls
 */
export function useTimer({
    initialElapsed = 0,
    isRunning = false,
}: UseTimerOptions = {}): UseTimerReturn {
    const [elapsedTime, setElapsedTime] = useState(initialElapsed)
    const [startTime, setStartTime] = useState<Date | null>(null)
    const [running, setRunning] = useState(isRunning)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Timer effect - only runs interval when active
    useEffect(() => {
        if (running && startTime) {
            intervalRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
            }, 1000)
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [running, startTime])

    const start = useCallback((fromTime?: Date) => {
        const time = fromTime ?? new Date()
        setStartTime(time)
        setRunning(true)
    }, [])

    const stop = useCallback(() => {
        setRunning(false)
    }, [])

    const restore = useCallback(
        (elapsed: number, fromTime: Date, isRunning: boolean) => {
            setStartTime(fromTime)
            setElapsedTime(elapsed)
            setRunning(isRunning)
        },
        []
    )

    const reset = useCallback(() => {
        setRunning(false)
        setElapsedTime(0)
        setStartTime(null)
    }, [])

    return {
        elapsedTime,
        startTime,
        start,
        stop,
        restore,
        reset,
        formatTime,
    }
}
