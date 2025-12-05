/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Applies makeup (lipstick) from a product image onto a selfie.
 * Calls the serverless API endpoint which handles Gemini API securely.
 */
export const generateTryOn = async (
  lipstickImage: string,
  selfieImage: string
): Promise<string> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lipstickImage,
        selfieImage,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
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