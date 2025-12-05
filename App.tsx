/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { Sparkles, Download, Scan } from 'lucide-react';
import { Button } from './components/Button';
import { FileUploader } from './components/FileUploader';
import { generateTryOn } from './services/geminiService';
import { LoadingState } from './types';
import { useApiKey } from './hooks/useApiKey';
import ApiKeyDialog from './components/ApiKeyDialog';

export default function App() {
  // State
  const [tryOnLipstick, setTryOnLipstick] = useState<string | null>(null);
  const [tryOnSelfie, setTryOnSelfie] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isGenerating: false, message: '' });

  // API Key Management
  const { showApiKeyDialog, setShowApiKeyDialog, validateApiKey, handleApiKeyDialogContinue } = useApiKey();

  // Helper to read file as Data URL
  const handleFile = (file: File, setter: (val: string | null) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
       if (e.target?.result) {
          setter(e.target.result as string);
       }
    };
    reader.readAsDataURL(file);
  };

  // Error Handler
  const handleApiError = (error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let shouldOpenDialog = false;

    if (errorMessage.includes('Requested entity was not found')) {
      shouldOpenDialog = true;
    } else if (
      errorMessage.includes('API_KEY_INVALID') ||
      errorMessage.includes('API key not valid') ||
      errorMessage.includes('PERMISSION_DENIED') || 
      errorMessage.includes('403')
    ) {
      shouldOpenDialog = true;
    }

    if (shouldOpenDialog) {
      setShowApiKeyDialog(true);
    } else {
      alert(`Operation failed: ${errorMessage}`);
    }
  };

  // Main Action
  const handleTryOn = async () => {
     if (!tryOnLipstick || !tryOnSelfie) return;
     
     if (!(await validateApiKey())) return;

     setLoading({ isGenerating: true, message: 'Applying makeup...' });
     try {
        const result = await generateTryOn(tryOnLipstick, tryOnSelfie);
        setTryOnResult(result);
     } catch (e: any) {
        handleApiError(e);
     } finally {
        setLoading({ isGenerating: false, message: '' });
     }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans flex flex-col items-center py-12 px-4 selection:bg-indigo-500/30">
      
      {/* API Key Dialog Overlay */}
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}

      <div className="max-w-4xl w-full animate-fade-in">
         
         {/* Header */}
         <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-4 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6 shadow-2xl">
               <Scan size={32} className="text-indigo-500" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
               Virtual Lipstick <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">Try-On</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
               Experience instant virtual makeup. Upload a lipstick swatch (or screenshot) and a selfie to see the magic happen.
            </p>
         </div>

         {/* Main Input Area */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            
            {/* 1. Lipstick Input */}
             <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">1</span>
                        Lipstick Source
                    </h3>
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-900 px-2 py-1 rounded">Photo or Screenshot</span>
                </div>
                <div className="h-[300px]">
                    <FileUploader
                    label="Upload Lipstick"
                    currentPreview={tryOnLipstick || undefined}
                    onFileSelect={(f) => handleFile(f, setTryOnLipstick)}
                    onClear={() => setTryOnLipstick(null)}
                    />
                </div>
            </div>

            {/* 2. Selfie Input */}
             <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">2</span>
                        Your Selfie
                    </h3>
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-900 px-2 py-1 rounded">Good lighting works best</span>
                </div>
                <div className="h-[300px]">
                    <FileUploader
                    label="Upload Selfie"
                    currentPreview={tryOnSelfie || undefined}
                    onFileSelect={(f) => handleFile(f, setTryOnSelfie)}
                    onClear={() => setTryOnSelfie(null)}
                    />
                </div>
            </div>
         </div>

         {/* Action Button */}
         <div className="flex justify-center mb-16 relative z-10">
            <Button
               size="lg"
               disabled={!tryOnLipstick || !tryOnSelfie}
               isLoading={loading.isGenerating}
               onClick={handleTryOn}
               icon={<Sparkles size={20} />}
               className="w-full md:w-auto px-16 py-4 text-lg rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] transition-all transform hover:-translate-y-1"
            >
               {loading.isGenerating ? "Applying Makeup..." : "Apply Makeup"}
            </Button>
         </div>

         {/* Result Area */}
         {tryOnResult && (
            <div className="animate-slide-up border-t border-zinc-800 pt-16">
               <div className="flex items-center gap-4 mb-8">
                   <div className="h-px bg-zinc-800 flex-1"></div>
                   <h3 className="text-2xl font-bold text-center text-white">Your New Look</h3>
                   <div className="h-px bg-zinc-800 flex-1"></div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-zinc-900/40 p-6 md:p-8 rounded-3xl border border-zinc-800/50 backdrop-blur-sm">
                  {/* Before Preview */}
                  <div className="space-y-3">
                      <p className="text-center text-sm font-medium text-zinc-500 uppercase tracking-widest">Original</p>
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-700/50 group">
                         <img src={tryOnSelfie!} className="w-full h-full object-cover opacity-60 grayscale-[30%] transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-100" alt="Original" />
                      </div>
                  </div>
                  
                  {/* After Result */}
                  <div className="space-y-3">
                      <p className="text-center text-sm font-bold text-indigo-400 uppercase tracking-widest">Result</p>
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl">
                         <img src={tryOnResult} className="w-full h-full object-cover" alt="Result" />
                         
                         {/* Download Overlay */}
                         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-6">
                             <a href={tryOnResult} download="makeup-try-on.png" className="w-full transform translate-y-4 hover:translate-y-0 transition-transform duration-300">
                                <Button size="md" className="w-full bg-white text-black hover:bg-zinc-200" icon={<Download size={18}/>}>Save Image</Button>
                             </a>
                         </div>
                      </div>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}