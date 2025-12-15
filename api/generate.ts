/**
 * Vercel Serverless Function for Virtual Makeup Try-On
 * Uses Replicate's nano-banana-pro model for image editing
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';
import { rateLimit } from '../lib/rateLimit';

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

        console.log('Running virtual try-on with nano-banana-pro...');

        // Use nano-banana-pro for image editing
        // This model can edit images based on text prompts
        const output = await replicate.run(
            "google/nano-banana-pro",
            {
                input: {
                    image: selfieImage,
                    prompt: "Apply the exact lipstick color from the reference image to the lips. Keep everything else identical - same person, same face, same hair, same background, same lighting. Only change the lip color to match the lipstick shade. Professional makeup application, photorealistic.",
                    negative_prompt: "different person, different face, blur, distortion, low quality, artifacts",
                    num_inference_steps: 28,
                    guidance_scale: 3.5,
                    output_format: "png",
                    output_quality: 90,
                    aspect_ratio: "1:1"
                }
            }
        );

        console.log('Try-on completed successfully');

        // Output is an array of URLs or a single URL
        const resultUrl = Array.isArray(output) ? output[0] : output;

        return res.status(200).json({
            success: true,
            image: resultUrl,
        });

    } catch (error: any) {
        console.error('Generate API error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API token')) {
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
