/**
 * Auth Callback - Handles OAuth redirect
 */
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Exchange code for session
                const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

                if (error) {
                    console.error('[auth-callback] exchange failed:', error);
                }

                // Always redirect to home (session will be picked up by AuthContext)
                window.location.href = '/';
            } catch (err) {
                console.error('[auth-callback] unexpected error:', err);
                window.location.href = '/';
            }
        };

        handleCallback();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-coral-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Completing sign in...</p>
            </div>
        </div>
    );
}
