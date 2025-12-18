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

        let timeoutId: NodeJS.Timeout;
        let hasRedirected = false;

        // Listen for auth state changes - this will fire when Supabase completes the automatic code exchange
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔵 [auth-callback] Auth state changed:', {
                event,
                hasSession: !!session,
                userId: session?.user?.id,
                email: session?.user?.email
            });

            if (event === 'SIGNED_IN' && session && !hasRedirected) {
                hasRedirected = true;
                clearTimeout(timeoutId);

                console.log('✅ [auth-callback] Sign in successful! Session created.');

                // Check localStorage to verify session was persisted
                const storageKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
                console.log('✅ [auth-callback] localStorage keys:', storageKeys);

                try {
                    sessionStorage.removeItem('postAuthRedirect');
                } catch {
                    // ignore
                }

                console.log('🔵 [auth-callback] Redirecting to:', returnTo);
                window.location.replace(returnTo);
            }
        });

        // Fallback timeout in case the auth state change doesn't fire
        timeoutId = setTimeout(async () => {
            if (hasRedirected) return;

            console.log('⚠️ [auth-callback] No SIGNED_IN event after 3 seconds, checking session manually...');
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                console.error('🔴 [auth-callback] Session error:', error);
                setErrorMessage(error.message || 'Could not complete sign in. Please try again.');
                return;
            }

            if (data.session && !hasRedirected) {
                hasRedirected = true;
                console.log('✅ [auth-callback] Found existing session, redirecting...');

                try {
                    sessionStorage.removeItem('postAuthRedirect');
                } catch {
                    // ignore
                }

                window.location.replace(returnTo);
            } else {
                console.error('🔴 [auth-callback] No session found after 3 seconds');
                setErrorMessage('Failed to complete sign in. Please try again.');
            }
        }, 3000);

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
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
