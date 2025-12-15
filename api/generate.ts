/**
 * Vercel Serverless Function for Virtual Makeup Try-On
 * Uses Replicate's nano-banana model
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';
// import { createClient } from '@supabase/supabase-js'; // Uncomment when enabling quotas
import { rateLimit } from '../lib/rateLimit.js';

// const DAILY_LIMIT = Number(process.env.DAILY_TRYON_LIMIT || '50'); // Uncomment when enabling quotas

function getClientIp(req: VercelRequest): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor.split(',')[0].trim();
    }
    return (req.headers['x-real-ip'] as string) || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1) IP-based rate limiting (bot protection, always enabled)
    const clientIp = getClientIp(req);
    const ipAllowed = rateLimit(`tryon:${clientIp}`, {
        interval: 60 * 60 * 1000, // 1 hour
        maxRequests: 10, // 10 per hour per IP (increased from 5 for logged-in users)
    });

    if (!ipAllowed) {
        return res.status(429).json({
            error: 'Too many requests from this IP. Please try again later.'
        });
    }

    // 2) User-based daily quota enforcement (DISABLED - run SQL in Supabase first)
    // TODO: Uncomment after running supabase-usage-schema.sql in Supabase
    /*
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
            try {
                const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${token}` } },
                });

                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user) {
                    const { data: usageData, error: usageError } = await supabase
                        .rpc('check_and_increment_tryons', { daily_limit: DAILY_LIMIT });

                    if (!usageError && !usageData?.allowed) {
                        return res.status(429).json({
                            error: `Daily limit of ${DAILY_LIMIT} try-ons reached. Resets tomorrow.`,
                            usage: usageData,
                        });
                    }
                }
            } catch (error) {
                console.error('Quota check failed:', error);
            }
        }
    }
    */

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
        console.log('Output type:', typeof output);
        console.log('Output:', output);

        // Replicate returns a File object with .url() method
        let resultUrl: string;
        if (output && typeof output === 'object' && 'url' in output) {
            resultUrl = (output as any).url();
        } else if (typeof output === 'string') {
            resultUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
            resultUrl = output[0];
        } else {
            throw new Error('Unexpected output format from Replicate');
        }

        console.log('Result URL:', resultUrl);

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
