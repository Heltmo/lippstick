/**
 * Auth Callback - Handles OAuth redirect
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        console.log('🔵 [auth-callback] Page loaded');
        console.log('🔵 [auth-callback] Full URL:', window.location.href);
        console.log('🔵 [auth-callback] Search params:', window.location.search);
        console.log('🔵 [auth-callback] Hash:', window.location.hash);

        const returnTo = (() => {
            try {
                const stored = sessionStorage.getItem('postAuthRedirect');
                console.log('🔵 [auth-callback] Stored redirect:', stored);
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
                console.log('🔵 [auth-callback] Code param:', code ? 'EXISTS' : 'MISSING');

                // With `detectSessionInUrl: true`, Supabase will usually process the callback automatically
                // during initialization. Prefer checking session first to avoid double-exchange (which
                // clears the stored PKCE verifier and causes a 400).
                console.log('🔵 [auth-callback] Checking for existing session...');
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('🔴 [auth-callback] Session check error:', sessionError);
                    throw sessionError;
                }

                console.log('🔵 [auth-callback] Existing session:', {
                    hasSession: !!sessionData.session,
                    userId: sessionData.session?.user?.id,
                    expiresAt: sessionData.session?.expires_at
                });

                if (!sessionData.session && code) {
                    console.log('🔵 [auth-callback] No session found, exchanging code...');
                    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (exchangeError) {
                        console.error('🔴 [auth-callback] Code exchange failed:', exchangeError);
                        throw exchangeError;
                    }

                    console.log('✅ [auth-callback] Code exchange successful:', {
                        hasSession: !!exchangeData.session,
                        userId: exchangeData.session?.user?.id
                    });
                }

                // Check localStorage to see if session was stored
                const storageKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
                console.log('🔵 [auth-callback] localStorage keys:', storageKeys);

                try {
                    sessionStorage.removeItem('postAuthRedirect');
                } catch {
                    // ignore
                }

                console.log('🔵 [auth-callback] Redirecting to:', returnTo);
                window.location.replace(returnTo);
            } catch (err: any) {
                console.error('🔴 [auth-callback] OAuth callback error:', err);
                console.error('🔴 [auth-callback] Error details:', {
                    message: err?.message,
                    status: err?.status,
                    code: err?.code
                });
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
