/**
 * Auth Callback - Handles OAuth redirect
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Check for error in URL params
                const params = new URLSearchParams(window.location.search);
                const errorParam = params.get('error');
                const errorDescription = params.get('error_description');

                if (errorParam) {
                    console.error('[auth-callback] OAuth error:', errorParam, errorDescription);
                    setError(errorDescription || 'Authentication failed');
                    setTimeout(() => window.location.href = '/', 3000);
                    return;
                }

                console.log('[auth-callback] Waiting for Supabase to process auth...');

                // Just wait for Supabase's onAuthStateChange to fire
                // It will automatically detect the session in the URL and redirect
                // DO NOT call window.location.href here - it breaks implicit flow

            } catch (err) {
                console.error('[auth-callback] Unexpected error:', err);
                setError('An unexpected error occurred');
                setTimeout(() => window.location.href = '/', 3000);
            }
        };

        handleCallback();

        // Listen for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[auth-callback] Auth state changed:', event, !!session);

            if (event === 'SIGNED_IN' && session) {
                console.log('[auth-callback] Sign in detected, redirecting to home...');
                // Small delay to ensure session is stored
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
                <div className="text-center max-w-md">
                    <div className="text-5xl mb-4">⚠️</div>
                    <p className="text-red-600 font-semibold mb-2">Sign in failed</p>
                    <p className="text-gray-600 text-sm mb-4">{error}</p>
                    <p className="text-gray-400 text-xs">Redirecting to home...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-coral-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Completing sign in...</p>
            </div>
        </div>
    );
}
