/**
 * Auth Callback - Handles OAuth redirect
 */
import { useEffect } from 'react';

export default function AuthCallback() {
    useEffect(() => {
        // Redirect to home with hash preserved
        // This allows Supabase SDK to process the #access_token
        const hash = window.location.hash;
        console.log('[auth-callback] Redirecting with hash:', hash ? 'yes' : 'no');

        setTimeout(() => {
            window.location.replace('/' + hash);
        }, 100);
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
