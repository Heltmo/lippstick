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

        let hasRedirected = false;

        const completeSignIn = async () => {
            if (hasRedirected) return;
            hasRedirected = true;

            console.log('✅ [auth-callback] Sign in successful! Session created.');

            // Wait for Supabase to persist the session to localStorage
            // Increased delay to ensure write completes before redirect
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Clean up old custom storageKey if it exists
            if (localStorage.getItem('sb-auth-token')) {
                console.log('⚠️ [auth-callback] Removing old sb-auth-token key');
                localStorage.removeItem('sb-auth-token');
            }

            // Check localStorage to verify session was persisted
            const storageKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'));
            console.log('✅ [auth-callback] localStorage keys after delay:', storageKeys);

            if (storageKeys.length === 0) {
                console.warn('⚠️ [auth-callback] Session not persisted to localStorage yet, waiting longer...');
                await new Promise(resolve => setTimeout(resolve, 500));

                const retryKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'));
                console.log('✅ [auth-callback] localStorage keys after retry:', retryKeys);
            }

            try {
                sessionStorage.removeItem('postAuthRedirect');
            } catch {
                // ignore
            }

            console.log('🔵 [auth-callback] Redirecting to:', returnTo);
            window.location.replace(returnTo);
        };

        const init = async () => {
            // First, check if session already exists (SIGNED_IN event may have already fired)
            console.log('🔵 [auth-callback] Checking for existing session...');
            const { data: existingData, error: existingError } = await supabase.auth.getSession();

            if (existingError) {
                console.error('🔴 [auth-callback] Session error:', existingError);
                setErrorMessage(existingError.message || 'Could not complete sign in. Please try again.');
                return;
            }

            console.log('🔵 [auth-callback] Existing session check:', {
                hasSession: !!existingData.session,
                userId: existingData.session?.user?.id,
                email: existingData.session?.user?.email
            });

            if (existingData.session) {
                // Session already exists, redirect immediately
                await completeSignIn();
                return;
            }

            // No session yet, listen for SIGNED_IN event
            console.log('🔵 [auth-callback] No session yet, waiting for auth event...');

            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔵 [auth-callback] Auth state changed:', {
                    event,
                    hasSession: !!session,
                    userId: session?.user?.id,
                    email: session?.user?.email
                });

                if (event === 'SIGNED_IN' && session) {
                    await completeSignIn();
                }
            });

            // Timeout after 5 seconds if nothing happens
            setTimeout(async () => {
                if (hasRedirected) return;

                console.log('⚠️ [auth-callback] Timeout reached, checking session one more time...');
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('🔴 [auth-callback] Session error:', error);
                    setErrorMessage(error.message || 'Could not complete sign in. Please try again.');
                    return;
                }

                if (data.session) {
                    await completeSignIn();
                } else {
                    console.error('🔴 [auth-callback] No session found after timeout');
                    setErrorMessage('Failed to complete sign in. Please try again.');
                }

                subscription.unsubscribe();
            }, 5000);
        };

        init();
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
