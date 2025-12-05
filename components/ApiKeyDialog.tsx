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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div className="glass-panel bg-zinc-900/95 border border-zinc-700 rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center flex flex-col items-center">
        <div className="bg-amber-600/20 p-4 rounded-full mb-6">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">API Error</h2>
        <p className="text-zinc-300 mb-6">
          {errorMessage || 'There was an issue with the AI service.'}
        </p>
        <p className="text-zinc-400 mb-8 text-sm">
          This could be due to server configuration, API quota limits, or temporary service issues.
          Please try again later or contact the administrator.
        </p>
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors text-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDialog;