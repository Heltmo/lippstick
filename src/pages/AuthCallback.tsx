/**
 * Auth Callback - Handles OAuth redirect
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const returnTo = (() => {
            try {
                const stored = sessionStorage.getItem('postAuthRedirect');
                if (stored && stored.startsWith('/')) return stored;
            } catch {
                // ignore
            }
            return '/';
        })();

        const run = async () => {
            try {
                // PKCE flow returns `?code=...` and requires an exchange to create a session.
                const hasCode = new URLSearchParams(window.location.search).has('code');
                if (hasCode) {
                    const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
                    if (error) throw error;
                } else {
                    // Legacy implicit flow uses hash tokens; ensure SDK processes them.
                    const { error } = await supabase.auth.getSession();
                    if (error) throw error;
                }

                try {
                    sessionStorage.removeItem('postAuthRedirect');
                } catch {
                    // ignore
                }

                window.location.replace(returnTo);
            } catch (err: any) {
                console.error('[auth-callback] OAuth callback error:', err);
                setErrorMessage(err?.message || 'Could not complete sign in. Please try again.');
            }
        };

        void run();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-coral-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{errorMessage ? errorMessage : 'Completing sign in...'}</p>
            </div>
        </div>
    );
}
