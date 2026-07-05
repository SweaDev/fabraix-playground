import { useId } from 'react'
import { usePlatform } from '@/context/platform'

interface ModelPickerProps {
    /** Disable while a restart / switch is in flight. */
    disabled?: boolean
}

/**
 * Lets the player choose which model to face. Models are shown under OPAQUE,
 * randomly-assigned display names only — the real model is never exposed here.
 * The catalog and the selection live in the platform context, so the rail picker
 * (desktop) and the chat-header picker (mobile) are the same control; changing
 * it restarts the live session onto that model (ChatView reacts to the change).
 */
export function ModelPicker({ disabled }: ModelPickerProps) {
    const { models, variantId, setVariantId } = usePlatform()
    // The picker renders twice (rail + chat header) — ids must not collide.
    const selectId = useId()

    // Nothing to pick from — hide the control entirely.
    if (models.length === 0) return null

    return (
        <div className="pg-model-picker">
            <label className="pg-model-picker-label" htmlFor={selectId}>Model</label>
            <select
                id={selectId}
                className="pg-select"
                aria-label="Model to face"
                value={variantId ?? models[0].id}
                disabled={disabled}
                onChange={(e) => setVariantId(e.target.value)}
            >
                {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
            </select>
        </div>
    )
}
