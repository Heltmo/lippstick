/**
 * Auth Context - Manages user authentication state
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch or create user profile
    const fetchProfile = async (userId: string, email: string) => {
        console.log('Fetching profile for user:', userId);
        try {
            // Try to get existing profile
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            console.log('Profile fetch result:', { data, error });

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                console.log('Creating new profile...');
                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        email: email,
                        free_tries_used: 0,
                        paid_tries_remaining: 0,
                    })
                    .select()
                    .single();

                console.log('Profile creation result:', { newProfile, insertError });

                if (insertError) {
                    console.error('Profile creation error:', insertError);
                    // Even if insert fails, create a local profile so the app works
                    setProfile({
                        id: userId,
                        email: email,
                        free_tries_used: 0,
                        paid_tries_remaining: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                } else {
                    setProfile(newProfile);
                }
            } else if (error) {
                console.error('Profile fetch error:', error);
                // Create a local profile so the app works
                setProfile({
                    id: userId,
                    email: email,
                    free_tries_used: 0,
                    paid_tries_remaining: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            } else {
                setProfile(data);
            }
        } catch (err) {
            console.error('Error in fetchProfile:', err);
            // Create a local profile so the app works
            setProfile({
                id: userId,
                email: email,
                free_tries_used: 0,
                paid_tries_remaining: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id, user.email || '');
        }
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Initial session:', session?.user?.email);
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email || '');
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth state change:', event, session?.user?.email);
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id, session.user.email || '');
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            loading,
            signInWithGoogle,
            signOut,
            refreshProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
