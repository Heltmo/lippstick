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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Include auth token if user is logged in
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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