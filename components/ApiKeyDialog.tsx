/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ApiKeyDialogProps {
    onContinue: () => void;
    errorMessage?: string;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onContinue, errorMessage }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center flex flex-col items-center">
                <div className="bg-amber-100 p-4 rounded-full mb-6">
                    <AlertTriangle className="w-12 h-12 text-amber-500" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">API Error</h2>
                <p className="text-gray-600 mb-6">
                    {errorMessage || 'There was an issue with the AI service.'}
                </p>
                <p className="text-gray-400 mb-8 text-sm">
                    This could be due to server configuration, API quota limits, or temporary service issues.
                    Please try again later.
                </p>
                <button
                    onClick={onContinue}
                    className="w-full px-6 py-3 bg-coral-400 hover:bg-coral-500 text-white font-semibold rounded-lg transition-colors text-lg"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default ApiKeyDialog;
