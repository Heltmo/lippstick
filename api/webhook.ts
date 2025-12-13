/**
 * Stripe Webhook - Handles successful payments
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;

    try {
        // Get raw body
        const rawBody = JSON.stringify(req.body);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const tries = parseInt(session.metadata?.tries || '20');

        if (userId) {
            // Add tries to user's account
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('paid_tries_remaining')
                .eq('id', userId)
                .single();

            if (!fetchError && profile) {
                const newTries = (profile.paid_tries_remaining || 0) + tries;

                await supabase
                    .from('profiles')
                    .update({ paid_tries_remaining: newTries })
                    .eq('id', userId);

                console.log(`Added ${tries} tries to user ${userId}. New total: ${newTries}`);
            }
        }
    }

    return res.status(200).json({ received: true });
}
