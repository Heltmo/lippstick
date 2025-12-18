/**
 * Supabase Client Configuration
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Google OAuth for SPAs uses the authorization code (PKCE) flow.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Types for our database
export interface UserProfile {
    id: string;
    email: string;
    free_tries_used: number;
    paid_tries_remaining: number;
    created_at: string;
    updated_at: string;
}
