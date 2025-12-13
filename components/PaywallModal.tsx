/**
 * Paywall Modal - After free try is used
 */
import React, { useState } from 'react';
import { Sparkles, Check, Lock } from 'lucide-react';

interface PaywallModalProps {
    onClose?: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(false);

    const handlePurchase = async () => {
        setLoading(true);
        try {
            // Call our Stripe checkout API
            const response = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const { url, error } = await response.json();

            if (error) {
                alert(error);
                setLoading(false);
                return;
            }

            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (err) {
            console.error('Checkout error:', err);
            alert('Failed to start checkout. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-coral-400 to-coral-500 rounded-full mb-6">
                    <Lock className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Love Your New Look? 💄
                </h2>
                <p className="text-gray-500 mb-8">
                    Unlock unlimited virtual try-ons
                </p>

                {/* Pricing Card */}
                <div className="bg-gradient-to-br from-cream-100 to-cream-200 rounded-xl p-6 mb-6 border border-coral-200">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-4xl font-bold text-gray-800">$4.99</span>
                        <span className="text-gray-500">/ 20 tries</span>
                    </div>

                    <ul className="text-left space-y-3 text-gray-600">
                        <li className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span>20 high-quality lipstick try-ons</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span>Download all your looks</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span>Any lipstick shade</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span>Never expires</span>
                        </li>
                    </ul>
                </div>

                {/* CTA Button */}
                <button
                    onClick={handlePurchase}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white font-semibold rounded-xl transition-all text-lg shadow-lg disabled:opacity-50"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Get 20 Tries
                        </>
                    )}
                </button>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 text-gray-400 text-xs">
                    <span>🔒 Secure checkout</span>
                    <span>•</span>
                    <span>Powered by Stripe</span>
                </div>
            </div>
        </div>
    );
};

export default PaywallModal;
