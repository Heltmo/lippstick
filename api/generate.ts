/**
 * Vercel Serverless Function for Gemini API
 * This keeps the API key secure on the server
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

// CORS headers for the API
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lipstickImage, selfieImage } = req.body;

        if (!lipstickImage || !selfieImage) {
            return res.status(400).json({ error: 'Missing required images' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY environment variable not set');
            return res.status(500).json({ error: 'Server configuration error: API key not set' });
        }

        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.0-flash-exp';

        // Strip data URL prefix to get base64 data
        const getBase64Data = (dataUrl: string): string => dataUrl.split(',')[1];

        const parts = [
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: getBase64Data(lipstickImage),
                },
            },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: getBase64Data(selfieImage),
                },
            },
            {
                text: `Reference image: First image (Lipstick Product/Swatch).
Target image: Second image (Person/Selfie).

Task: Apply ONLY lipstick to the lips of the person in the target image, using the exact color, texture, and finish from the reference image.

Strict rules: 
- Change ABSOLUTELY NOTHING ELSE: Keep face shape, eyes, eyebrows, skin texture, pores, hair, teeth, expression, lighting, background, and aspect ratio 100% identical to the original selfie. 
- Perfect seamless blending: No edges, bleeding, or artifacts—lips look naturally enhanced, photorealistic, high-resolution. 
- Match skin tone and natural contours exactly. 
- Output: Photorealistic portrait, same resolution as input. Do not add blush, eyeshadow, filters, or any other makeup.`,
            },
        ];

        const response = await ai.models.generateContent({
            model,
            contents: { parts },
            config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
        });

        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return res.status(200).json({
                        success: true,
                        image: `data:image/png;base64,${part.inlineData.data}`,
                    });
                }
            }
        }

        return res.status(500).json({ error: 'No image data found in response' });
    } catch (error: any) {
        console.error('Generate API error:', error);

        // Handle specific API errors
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
            return res.status(401).json({ error: 'Invalid API key configured on server' });
        }

        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
            return res.status(403).json({ error: 'API key does not have permission for this model' });
        }

        if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
        }

        return res.status(500).json({ error: `Generation failed: ${errorMessage}` });
    }
}
