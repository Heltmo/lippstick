/**
 * Vercel Serverless Function for Virtual Makeup Try-On
 * Uses Replicate's nano-banana model
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { rateLimit } from '../lib/rateLimit.js';

const USER_DAILY_LIMIT = Number(process.env.USER_DAILY_TRYON_LIMIT || '4');
const ANON_DAILY_LIMIT = Number(process.env.ANON_DAILY_TRYON_LIMIT || '3');
const ANON_COOKIE = '__Host-tryon_anon';

console.log("[quota]", {
    anon: process.env.ANON_DAILY_TRYON_LIMIT,
    user: process.env.USER_DAILY_TRYON_LIMIT,
    legacy: process.env.DAILY_TRYON_LIMIT,
});

function getClientIp(req: VercelRequest): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor.split(',')[0].trim();
    }
    return (req.headers['x-real-ip'] as string) || req.socket?.remoteAddress || 'unknown';
}

function parseCookies(req: VercelRequest): Record<string, string> {
    const header = req.headers.cookie;
    const out: Record<string, string> = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const [key, ...valueParts] = part.trim().split('=');
        if (!key) continue;
        out[key] = decodeURIComponent(valueParts.join('=') || '');
    }
    return out;
}

function setAnonCookie(res: VercelResponse, value: string) {
    const secure = process.env.VERCEL ? '; Secure' : '';
    const cookie = `${ANON_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
    const prev = res.getHeader('Set-Cookie');
    if (!prev) res.setHeader('Set-Cookie', cookie);
    else if (Array.isArray(prev)) res.setHeader('Set-Cookie', [...prev, cookie]);
    else res.setHeader('Set-Cookie', [prev as string, cookie]);
}

function getOrCreateAnonId(req: VercelRequest, res: VercelResponse): string {
    const cookies = parseCookies(req);
    const existing = cookies[ANON_COOKIE];
    if (existing && existing.length >= 16) return existing;
    const id = crypto.randomBytes(16).toString('hex');
    setAnonCookie(res, id);
    return id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1) Get auth token early for rate limiting decisions
    const clientIp = getClientIp(req);
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // IP-based rate limiting - stricter for anonymous, lenient for authenticated
    const ipRateLimit = token
        ? { interval: 60 * 60 * 1000, maxRequests: 20 } // Authenticated: 20/hour (generous for legitimate use)
        : { interval: 60 * 60 * 1000, maxRequests: 5 };  // Anonymous: 5/hour (prevents localStorage bypass abuse)

    const ipAllowed = rateLimit(`tryon:${clientIp}`, ipRateLimit);

    if (!ipAllowed) {
        return res.status(429).json({
            error: token
                ? 'Too many requests. Please wait before trying again.'
                : 'Too many requests from this IP. Sign in for higher limits or try again later.'
        });
    }

    let quotaReservation: null | { kind: 'user'; supabaseUser: any } | { kind: 'anon'; anonId: string; supabaseAdmin: any } = null;

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

        // 2) Server-side daily quota enforcement (Supabase RPC)
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            return res.status(500).json({ error: 'Server configuration error: Supabase env not set' });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Prefer authenticated quota if token is valid; otherwise fall back to anonymous quota.
        let usedAuthenticatedQuota = false;
        if (token) {
            const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: `Bearer ${token}` } },
            });

            const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
            if (!userErr && userData?.user) {
                const { data: usageData, error: usageError } = await supabaseUser
                    .rpc('check_and_increment_tryons', { daily_limit: USER_DAILY_LIMIT });

                if (usageError) {
                    return res.status(500).json({ error: 'Quota check failed', details: usageError.message });
                }
                if (!usageData?.allowed) {
                    return res.status(429).json({
                        error: 'user_limit_reached',
                        message: `Daily limit reached (${usageData.count}/${usageData.limit}). Resets tomorrow.`,
                        usage: usageData,
                    });
                }
                usedAuthenticatedQuota = true;
                quotaReservation = { kind: 'user', supabaseUser };
            }
        }

        if (!usedAuthenticatedQuota) {
            const anonId = getOrCreateAnonId(req, res);
            const { data: anonUsage, error: anonErr } = await supabaseAdmin.rpc('check_and_increment_tryons_anon', {
                p_anon_id: anonId,
                daily_limit: ANON_DAILY_LIMIT,
            });

            if (anonErr) {
                return res.status(500).json({ error: 'Anon quota check failed', details: anonErr.message });
            }
            if (!anonUsage?.allowed) {
                return res.status(429).json({
                    error: 'anon_limit_reached',
                    message: 'Anon limit reached. Sign in to continue.',
                    usage: anonUsage,
                });
            }
            quotaReservation = { kind: 'anon', anonId, supabaseAdmin };
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

        const safetyFiltered =
            errorMessage.toLowerCase().includes('flagged as sensitive') ||
            errorMessage.includes('(E005)') ||
            errorMessage.includes('E005');

        if (safetyFiltered && quotaReservation) {
            try {
                if (quotaReservation.kind === 'anon') {
                    await quotaReservation.supabaseAdmin.rpc('decrement_tryons_anon', { p_anon_id: quotaReservation.anonId });
                } else {
                    await quotaReservation.supabaseUser.rpc('decrement_tryons');
                }
            } catch (refundError) {
                console.error('Quota refund failed:', refundError);
            }

            return res.status(400).json({
                error: 'safety_filter',
                message: 'The image was blocked by the safety filter. Please try different images.',
            });
        }

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
