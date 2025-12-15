/**
 * Vercel Serverless Function for Virtual Makeup Try-On
 * Uses Replicate's nano-banana-pro model with polling for long-running tasks
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';
import { rateLimit } from '../lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting: 5 requests per hour per IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                     (req.headers['x-real-ip'] as string) ||
                     'unknown';

    const allowed = rateLimit(clientIp, {
        interval: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,
    });

    if (!allowed) {
        return res.status(429).json({
            error: 'Too many requests. Please try again later.'
        });
    }

    try {
        const { lipstickImage, selfieImage } = req.body;

        if (!lipstickImage || !selfieImage) {
            return res.status(400).json({ error: 'Missing required images' });
        }

        // Validate image sizes (base64 strings - roughly 5MB limit = ~7MB base64)
        const MAX_BASE64_SIZE = 7 * 1024 * 1024; // ~5MB original file size
        if (lipstickImage.length > MAX_BASE64_SIZE || selfieImage.length > MAX_BASE64_SIZE) {
            return res.status(400).json({ error: 'Image files are too large. Please use images smaller than 5MB.' });
        }

        const replicateKey = process.env.REPLICATE_API_TOKEN;
        if (!replicateKey) {
            return res.status(500).json({ error: 'Server configuration error: API key not set' });
        }

        const replicate = new Replicate({
            auth: replicateKey,
        });

        console.log('Starting virtual try-on with nano-banana...');

        // Use nano-banana (faster than pro version) with timeout handling
        const output = await Promise.race([
            replicate.run(
                "google/nano-banana",
                {
                    input: {
                        prompt: "Apply the exact lipstick color from the reference image to the person's lips. Keep everything else identical - same person, same face, same hair, same background, same lighting. Only change the lip color to match the lipstick shade. Professional makeup application, photorealistic, natural looking.",
                        image_input: [selfieImage, lipstickImage],
                        aspect_ratio: "match_input_image",
                        resolution: "2K",
                        output_format: "png",
                        safety_filter_level: "block_only_high"
                    }
                }
            ),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout after 55 seconds')), 55000)
            )
        ]);

        console.log('Try-on completed successfully');

        // Output is a URL string
        const resultUrl = output as unknown as string;

        return res.status(200).json({
            success: true,
            image: resultUrl,
        });

    } catch (error: any) {
        console.error('Generate API error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('timeout')) {
            return res.status(408).json({ error: 'Request took too long. The model is processing - please try again in a moment.' });
        }
        if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API token') || errorMessage.includes('Unauthorized')) {
            return res.status(401).json({ error: 'Invalid API key configured on server' });
        }
        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
            return res.status(403).json({ error: 'API key does not have permission' });
        }
        if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
        }

        return res.status(500).json({ error: `Generation failed: ${errorMessage}` });
    }
}
