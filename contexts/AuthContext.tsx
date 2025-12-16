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
    const isDev = !!import.meta?.env?.DEV;

    // Fetch or create user profile
    const fetchProfile = async (userId: string, email: string) => {
        try {
            // Try to get existing profile
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
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
        let isMounted = true;

        const initAuth = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (!isMounted) return;
                const initialSession = data.session;
                if (isDev) {
                    console.log('[auth] init getSession', { hasUser: !!initialSession?.user });
                }

                setSession(initialSession);
                setUser(initialSession?.user ?? null);
                if (initialSession?.user) {
                    await fetchProfile(initialSession.user.id, initialSession.user.email || '');
                } else {
                    setProfile(null);
                }
            } catch (error) {
                if (isDev) {
                    console.log('[auth] init getSession error', error);
                }
                if (!isMounted) return;
                setSession(null);
                setUser(null);
                setProfile(null);
            } finally {
                if (!isMounted) return;
                setLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
            if (isDev) {
                console.log('[auth] onAuthStateChange', { event, hasUser: !!nextSession?.user });
            }

            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            if (nextSession?.user) {
                await fetchProfile(nextSession.user.id, nextSession.user.email || '');
            } else {
                setProfile(null);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
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
