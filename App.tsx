/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, Download, Upload, CheckCircle, LogOut } from 'lucide-react';
import { Button } from './components/Button';
import { generateTryOn } from './services/geminiService';
import { LoadingState } from './types';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import LoginModal from './components/LoginModal';
import PaywallModal from './components/PaywallModal';

export default function App() {
   const [tryOnLipstick, setTryOnLipstick] = useState<string | null>(null);
   const [tryOnSelfie, setTryOnSelfie] = useState<string | null>(null);
   const [tryOnResult, setTryOnResult] = useState<string | null>(null);
   const [loading, setLoading] = useState<LoadingState>({ isGenerating: false, message: '' });

   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showPaywall, setShowPaywall] = useState(false);

   const lipstickInputRef = useRef<HTMLInputElement>(null);
   const selfieInputRef = useRef<HTMLInputElement>(null);

   const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth();

   const canTry = () => {
      if (!user) return false;
      if (!profile) return true; // Allow if profile not loaded yet
      if (profile.free_tries_used < 3) return true; // 3 free tries
      if (profile.paid_tries_remaining > 0) return true;
      return false;
   };

   const handleFile = (file: File, setter: (val: string | null) => void) => {
      // File size validation: max 5MB
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

      if (file.size > MAX_FILE_SIZE) {
         alert('Image is too large. Please upload an image smaller than 5MB.');
         return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
         if (e.target?.result) setter(e.target.result as string);
      };
      reader.readAsDataURL(file);
   };

   const handlePaste = useCallback((e: React.ClipboardEvent, setter: (val: string | null) => void) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
         if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) handleFile(file, setter);
            break;
         }
      }
   }, []);

   const handleDrop = useCallback((e: React.DragEvent, setter: (val: string | null) => void) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file, setter);
   }, []);

   const handleDragOver = (e: React.DragEvent) => e.preventDefault();

   const handleTryOn = async () => {
      if (!tryOnLipstick || !tryOnSelfie) return;

      // No auth required - open access for everyone

      // Generate
      setLoading({ isGenerating: true, message: 'Applying makeup...' });
      try {
         const result = await generateTryOn(tryOnLipstick, tryOnSelfie);
         setTryOnResult(result);

         // Skip database updates - no auth tracking
      } catch (e: any) {
         const errorMessage = e.message || String(e);
         let userMessage = 'Unable to apply makeup. Please try again.';

         if (errorMessage.includes('Too many requests')) {
            userMessage = 'You\'ve made too many requests. Please wait a bit before trying again.';
         } else if (errorMessage.includes('too large')) {
            userMessage = 'Your images are too large. Please use smaller images (under 5MB).';
         } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            userMessage = 'Service is temporarily busy. Please try again in a few minutes.';
         } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            userMessage = 'Network error. Please check your connection and try again.';
         }

         alert(userMessage);
      } finally {
         setLoading({ isGenerating: false, message: '' });
      }
   };

   // Show loading while auth initializes
   if (authLoading) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
            <div className="text-center">
               <div className="w-12 h-12 border-4 border-coral-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-gray-500">Loading...</p>
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen font-sans py-8 px-4 md:py-16">
         {showLoginModal && !user && <LoginModal onClose={() => setShowLoginModal(false)} />}
         {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}

         <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-12">
               <div className="flex items-center justify-end mb-8 min-h-[32px]">
                  {/* Auth removed - open access */}
               </div>

               <h1 className="font-serif text-5xl md:text-6xl font-semibold text-gray-800 mb-2 italic">
                  Makeup Atelier
               </h1>
               <p className="text-gray-500 tracking-[0.3em] text-sm uppercase">
                  AI Virtual Try-On
               </p>
            </div>

            {/* Upload Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
               {/* Product */}
               <div className="bg-white rounded-2xl p-6 card-shadow">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="flex items-center justify-center w-8 h-8 rounded-full bg-coral-400 text-white text-sm font-semibold">1</span>
                     <h2 className="text-xl font-semibold text-gray-800">Upload Product</h2>
                  </div>

                  <input ref={lipstickInputRef} type="file" accept="image/*" className="hidden"
                     onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], setTryOnLipstick)} />

                  <div
                     onClick={() => lipstickInputRef.current?.click()}
                     onPaste={(e) => handlePaste(e, setTryOnLipstick)}
                     onDrop={(e) => handleDrop(e, setTryOnLipstick)}
                     onDragOver={handleDragOver}
                     tabIndex={0}
                     className="dashed-border p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-coral-400/5 transition-colors min-h-[200px] focus:outline-none focus:ring-2 focus:ring-coral-400"
                  >
                     {tryOnLipstick ? (
                        <div className="relative w-full h-40">
                           <img src={tryOnLipstick} alt="Lipstick" className="w-full h-full object-contain" />
                           <button onClick={(e) => { e.stopPropagation(); setTryOnLipstick(null); }}
                              className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-100">
                              <span className="text-gray-500 text-sm">✕</span>
                           </button>
                        </div>
                     ) : (
                        <>
                           <div className="text-5xl mb-4">💄</div>
                           <p className="font-medium text-gray-700 mb-1">Makeup Product</p>
                           <p className="text-gray-400 text-sm text-center">Drag & drop, paste, or click</p>
                        </>
                     )}
                  </div>
               </div>

               {/* Selfie */}
               <div className="bg-white rounded-2xl p-6 card-shadow">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="flex items-center justify-center w-8 h-8 rounded-full bg-coral-400 text-white text-sm font-semibold">2</span>
                     <h2 className="text-xl font-semibold text-gray-800">Your Selfie</h2>
                  </div>

                  <input ref={selfieInputRef} type="file" accept="image/*" className="hidden"
                     onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], setTryOnSelfie)} />

                  <div
                     onClick={() => selfieInputRef.current?.click()}
                     onPaste={(e) => handlePaste(e, setTryOnSelfie)}
                     onDrop={(e) => handleDrop(e, setTryOnSelfie)}
                     onDragOver={handleDragOver}
                     tabIndex={0}
                     className="dashed-border p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-coral-400/5 transition-colors min-h-[200px] focus:outline-none focus:ring-2 focus:ring-coral-400 mb-4"
                  >
                     {tryOnSelfie ? (
                        <div className="relative w-full h-40">
                           <img src={tryOnSelfie} alt="Selfie" className="w-full h-full object-contain" />
                           <button onClick={(e) => { e.stopPropagation(); setTryOnSelfie(null); }}
                              className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-100">
                              <span className="text-gray-500 text-sm">✕</span>
                           </button>
                        </div>
                     ) : (
                        <>
                           <Upload className="w-12 h-12 text-coral-400 mb-4" />
                           <p className="font-medium text-gray-700 mb-1">Your Photo</p>
                           <p className="text-gray-400 text-sm text-center">Drag & drop, paste, or click</p>
                        </>
                     )}
                  </div>

                  {!tryOnSelfie && (
                     <div className="bg-cream-100 rounded-xl p-4">
                        <p className="text-gray-600 text-sm font-medium mb-2">📸 For best results:</p>
                        <ul className="text-gray-500 text-sm space-y-1 ml-4">
                           <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-sage-500" /> Face the camera directly</li>
                           <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-sage-500" /> Good, even lighting</li>
                           <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-sage-500" /> Neutral expression</li>
                        </ul>
                     </div>
                  )}
               </div>
            </div>

            {/* Button */}
            <div className="flex justify-center mb-12">
               <Button
                  size="lg"
                  disabled={!tryOnLipstick || !tryOnSelfie}
                  isLoading={loading.isGenerating}
                  onClick={handleTryOn}
                  icon={<Sparkles size={20} />}
                  className="px-12 py-4 text-lg rounded-full bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {loading.isGenerating ? "Applying Makeup..." : "Try It On"}
               </Button>
            </div>

            {/* Result */}
            {tryOnResult && (
               <div className="animate-slide-up">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="h-px bg-coral-300/50 flex-1"></div>
                     <h3 className="font-serif text-2xl font-semibold text-gray-800 italic">Your New Look</h3>
                     <div className="h-px bg-coral-300/50 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl p-6 md:p-8 card-shadow">
                     <div className="space-y-3">
                        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest">Original</p>
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200">
                           <img src={tryOnSelfie!} className="w-full h-full object-cover" alt="Original" />
                        </div>
                     </div>

                     <div className="space-y-3">
                        <p className="text-center text-sm font-semibold text-coral-500 uppercase tracking-widest">Result</p>
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-coral-400 shadow-lg group">
                           <img src={tryOnResult} className="w-full h-full object-cover" alt="Result" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-6">
                              <a href={tryOnResult} download="makeup-try-on.png" className="w-full">
                                 <Button size="md" className="w-full bg-white text-gray-800 hover:bg-gray-100" icon={<Download size={18} />}>
                                    Save Image
                                 </Button>
                              </a>
                           </div>
                        </div>
                     </div>
                  </div>

                  {profile && profile.free_tries_used >= 3 && profile.paid_tries_remaining === 0 && (
                     <div className="mt-8 text-center bg-gradient-to-r from-coral-50 to-cream-100 rounded-2xl p-6 border border-coral-200">
                        <p className="text-gray-700 font-medium mb-4">Love your looks? Get 20 more tries for $4.99! ✨</p>
                        <Button size="md" onClick={() => setShowPaywall(true)} icon={<Sparkles size={18} />}
                           className="bg-coral-500 text-white hover:bg-coral-600">
                           Unlock More Tries
                        </Button>
                     </div>
                  )}
               </div>
            )}

            <div className="text-center mt-12 text-gray-400 text-sm">
               Powered by <span className="text-coral-500">Gemini AI</span>
            </div>
         </div>
      </div>
   );
}
