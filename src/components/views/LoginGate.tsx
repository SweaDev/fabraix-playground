import { LogIn } from 'lucide-react'
import { useAuth } from '@/context/auth'

interface LoginGateProps {
    title: string
    message: string
}

/** Shared empty state for login-gated views: a headline + a sign-in CTA. */
export function LoginGate({ title, message }: LoginGateProps) {
    const { login } = useAuth()
    return (
        <div className="pg-gate">
            <h2 className="pg-gate-title">{title}</h2>
            <p className="pg-gate-message">{message}</p>
            <button className="pg-btn-primary" onClick={() => login()}>
                <LogIn size={16} />
                Sign in
            </button>
        </div>
    )
}
