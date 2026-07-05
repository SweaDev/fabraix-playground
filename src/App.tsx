import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import {
    RulesView,
    ChatView,
    LeaderboardView,
    PreviousChatsView,
    SubmissionsView,
    PrizesView,
} from '@/components/views'
import { PlatformProvider } from '@/context/platform'

/**
 * App root: the router + shared platform state.
 *
 * The OAuth token is already captured synchronously before mount
 * (captureTokenFromUrl in main.tsx), so routing is free to normalize the URL.
 * The callback lands the SPA at `/auth#token=...`; the `/auth` route just
 * redirects into the app (the token is persisted by then), and any unknown path
 * falls back to Rules so a hard reload on any tab still resolves.
 */
function App() {
    return (
        <BrowserRouter>
            <PlatformProvider>
                <Routes>
                    <Route path="/" element={<AppLayout />}>
                        <Route index element={<RulesView />} />
                        <Route path="chat" element={<ChatView />} />
                        <Route path="standings" element={<LeaderboardView />} />
                        <Route path="history" element={<PreviousChatsView />} />
                        <Route path="submissions" element={<SubmissionsView />} />
                        <Route path="rewards" element={<PrizesView />} />
                    </Route>
                    {/* OAuth callback lands here; token is already persisted pre-mount. */}
                    <Route path="/auth" element={<Navigate to="/chat" replace />} />
                    {/* Unknown paths → Rules, so a reload on any route still resolves. */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </PlatformProvider>
        </BrowserRouter>
    )
}

export default App
