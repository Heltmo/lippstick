/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';

/**
 * Applies makeup (lipstick) from a product image onto a selfie.
 * Calls the serverless API endpoint with auth token for quota tracking.
 */
export const generateTryOn = async (
  lipstickImage: string,
  selfieImage: string
): Promise<string> => {
  try {
    // Get current session token to send to API for quota enforcement
    let token: string | undefined;
    try {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[generateTryOn] Session error:', error);
        throw error;
      }
      token = sessionData?.session?.access_token;
      console.log('[generateTryOn] Session status:', {
        hasSession: !!sessionData?.session,
        hasToken: !!token,
        userId: sessionData?.session?.user?.id
      });
    } catch (error) {
      console.warn('[generateTryOn] Failed to get session, continuing without auth token:', error);
      // Continue without token - API will work for anonymous users
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include auth token if user is logged in
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[generateTryOn] ✅ Sending request WITH auth token');
    } else {
      console.warn('[generateTryOn] ⚠️ Sending request WITHOUT auth token (will use anon quota)');
    }

    console.log('[generateTryOn] Request headers:', { ...headers, Authorization: token ? 'Bearer ***' : undefined });

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lipstickImage,
        selfieImage,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle quota errors with specific messaging
      if (response.status === 429) {
        if (data.error === 'anon_limit_reached') {
          throw new Error(data.message || 'Sign in to continue');
        }
        if (data.error === 'user_limit_reached') {
          throw new Error(data.message || 'Daily limit reached. Try again tomorrow!');
        }
        if (data.usage) {
          throw new Error(
            `Daily limit reached (${data.usage.count}/${data.usage.limit}). Try again tomorrow!`
          );
        }
        throw new Error(data.error || 'Rate limit exceeded. Please try again later.');
      }
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    if (!data.success || !data.image) {
      throw new Error('No image received from server');
    }

    return data.image;
  } catch (error) {
    console.error('Try-on generation failed:', error);
    throw error;
  }
};
