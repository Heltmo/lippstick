/**
 * Vercel Serverless Function for Gemini API
 * Two-step: Extract color first, then apply with explicit hex value
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

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
            return res.status(500).json({ error: 'Server configuration error: API key not set' });
        }

        const ai = new GoogleGenAI({ apiKey });
        const getBase64Data = (dataUrl: string): string => dataUrl.split(',')[1];

        // ============================================
        // STEP 1: Extract exact color from lipstick
        // ============================================
        console.log('Step 1: Extracting lipstick color...');

        const colorResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: getBase64Data(lipstickImage),
                        },
                    },
                    {
                        text: `Analyze this lipstick image carefully. Look at the actual lipstick bullet/product color, NOT the packaging.

Extract the EXACT color of the lipstick and provide:
1. The precise HEX color code
2. The RGB values
3. A descriptive color name (e.g., "deep burgundy", "nude mauve", "coral pink")

Respond ONLY in this exact JSON format, nothing else:
{"hex": "#XXXXXX", "rgb": {"r": 0, "g": 0, "b": 0}, "name": "color name"}`,
                    },
                ],
            },
        });

        // Parse the color
        let colorInfo = { hex: '#8B4557', name: 'mauve' }; // fallback
        try {
            const colorText = colorResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log('Color extraction response:', colorText);

            const jsonMatch = colorText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                colorInfo = {
                    hex: parsed.hex || '#8B4557',
                    name: parsed.name || 'lipstick shade',
                };
            }
        } catch (e) {
            console.error('Color parsing failed:', e);
        }

        console.log('Extracted color:', colorInfo);

        // ============================================
        // STEP 2: Apply lipstick with exact color
        // ============================================
        console.log('Step 2: Applying lipstick with color', colorInfo.hex);

        const editPrompt = `You are a professional photo retoucher. Edit this selfie photo.

TASK: Apply lipstick color ${colorInfo.hex} (${colorInfo.name}) to the person's lips.

CRITICAL INSTRUCTIONS:
1. Apply EXACTLY the color ${colorInfo.hex} to the lips - this is a ${colorInfo.name} shade
2. The output must be the EXACT SAME PERSON as the input
3. Change NOTHING except the lip color:
   - Same face shape
   - Same skin
   - Same hair
   - Same eyes
   - Same eyebrows
   - Same lighting
   - Same background
   - Same resolution
4. Apply the lipstick naturally following the lip contours
5. Keep natural lip texture and shadows

Output: The same photo with only the lip color changed to ${colorInfo.hex}.`;

        const editResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: getBase64Data(selfieImage),
                        },
                    },
                    {
                        text: editPrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
        });

        const candidates = editResponse.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return res.status(200).json({
                        success: true,
                        image: `data:image/png;base64,${part.inlineData.data}`,
                        extractedColor: colorInfo,
                    });
                }
            }
        }

        return res.status(500).json({ error: 'No image data found in response' });
    } catch (error: any) {
        console.error('Generate API error:', error);
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
        if (errorMessage.includes('not available in your country')) {
            return res.status(403).json({ error: 'Image generation is not available in your region' });
        }

        return res.status(500).json({ error: `Generation failed: ${errorMessage}` });
    }
}
