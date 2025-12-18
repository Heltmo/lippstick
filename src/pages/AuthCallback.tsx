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

        const run = async () => {
            try {
                // With detectSessionInUrl: true, Supabase automatically exchanges the code
                // during client initialization. We need to wait a bit for this to complete.
                console.log('🔵 [auth-callback] Waiting for automatic code exchange...');

                // Wait for Supabase to process the URL
                await new Promise(resolve => setTimeout(resolve, 500));

                console.log('🔵 [auth-callback] Checking for session after exchange...');
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('🔴 [auth-callback] Session error:', error);
                    throw error;
                }

                console.log('🔵 [auth-callback] Session check result:', {
                    hasSession: !!data.session,
                    userId: data.session?.user?.id,
                    email: data.session?.user?.email,
                    expiresAt: data.session?.expires_at
                });

                if (!data.session) {
                    console.error('🔴 [auth-callback] No session found after OAuth callback');
                    throw new Error('Failed to create session. Please try logging in again.');
                }

                // Check localStorage to verify session was persisted
                const storageKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
                console.log('✅ [auth-callback] Session created! Storage keys:', storageKeys.length);

                try {
                    sessionStorage.removeItem('postAuthRedirect');
                } catch {
                    // ignore
                }

                console.log('🔵 [auth-callback] Redirecting to:', returnTo);
                window.location.replace(returnTo);
            } catch (err: any) {
                console.error('🔴 [auth-callback] OAuth callback error:', err);
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
