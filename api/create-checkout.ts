/**
 * Stripe Checkout API - Creates a checkout session for 20 tries ($4.99)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get user ID from request (you'd get this from the session/token in production)
        const { userId } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Makeup Atelier - 20 Try-Ons',
                            description: '20 AI-powered virtual lipstick try-ons',
                        },
                        unit_amount: 499, // $4.99 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_URL || 'https://lippstick.vercel.app'}?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://lippstick.vercel.app'}?canceled=true`,
            metadata: {
                userId: userId || '',
                tries: '20',
            },
        });

        return res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({ error: error.message });
    }
}
