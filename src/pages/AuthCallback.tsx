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
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');

                // With `detectSessionInUrl: true`, Supabase will usually process the callback automatically
                // during initialization. Prefer checking session first to avoid double-exchange (which
                // clears the stored PKCE verifier and causes a 400).
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;

                if (!sessionData.session && code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
