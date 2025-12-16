/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Download, Upload, CheckCircle, Sparkles, Lock } from 'lucide-react';
import { Button } from './components/Button';
import { generateTryOn } from './services/geminiService';
import { LoadingState } from './types';
import { useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';

const ANON_TRIES_LIMIT = 3;
const SIGNED_IN_TRIES_LIMIT = 4;

function getUtcDayKey() {
   return new Date().toISOString().slice(0, 10);
}

export default function App() {
   const { user, loading: authLoading, signOut } = useAuth();
   const [tryOnLipstick, setTryOnLipstick] = useState<string | null>(null);
   const [tryOnSelfie, setTryOnSelfie] = useState<string | null>(null);
   const [tryOnResult, setTryOnResult] = useState<string | null>(null);
   const [loading, setLoading] = useState<LoadingState>({ isGenerating: false, message: '' });
   const [showLogin, setShowLogin] = useState(false);
   const [showResultLock, setShowResultLock] = useState(false);
   const [freeTriesUsed, setFreeTriesUsed] = useState(0);
   const [signedInTriesUsed, setSignedInTriesUsed] = useState(0);

   const lipstickInputRef = useRef<HTMLInputElement>(null);
   const selfieInputRef = useRef<HTMLInputElement>(null);

   // Load tries from localStorage on mount / auth change
   useEffect(() => {
      const dayKey = getUtcDayKey();
      if (!user) {
         const stored = localStorage.getItem(`freeTriesUsed:${dayKey}`);
         setFreeTriesUsed(stored ? parseInt(stored, 10) : 0);
         setSignedInTriesUsed(0);
      } else {
         setShowResultLock(false);

         const storedSignedIn = localStorage.getItem(`signedInTriesUsed:${user.id}:${dayKey}`);
         setSignedInTriesUsed(storedSignedIn ? parseInt(storedSignedIn, 10) : 0);
      }
   }, [user]);

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
      const dayKey = getUtcDayKey();

      if (authLoading) return;

      if (!user && freeTriesUsed >= ANON_TRIES_LIMIT) {
         setShowResultLock(true);
         if (!authLoading) setShowLogin(true);
         return;
      }

      if (user && signedInTriesUsed >= SIGNED_IN_TRIES_LIMIT) {
         alert('You have used all your signed-in tries for now.');
         return;
      }

      // Allow the try-on to happen
      setLoading({ isGenerating: true, message: 'Applying makeup...' });
      try {
         const result = await generateTryOn(tryOnLipstick, tryOnSelfie);
         setTryOnResult(result);

         // After showing result, check if we should lock it
         if (!user) {
            const newCount = freeTriesUsed + 1;
            setFreeTriesUsed(newCount);
            localStorage.setItem(`freeTriesUsed:${dayKey}`, newCount.toString());

            if (newCount >= ANON_TRIES_LIMIT) {
               setShowResultLock(true);
            }
         } else {
            const newSignedInCount = signedInTriesUsed + 1;
            setSignedInTriesUsed(newSignedInCount);
            localStorage.setItem(`signedInTriesUsed:${user.id}:${dayKey}`, newSignedInCount.toString());
         }
      } catch (e: any) {
         const errorMessage = e.message || String(e);
         let userMessage = 'Unable to apply makeup. Please try again.';

         if (
            !authLoading &&
            (errorMessage.toLowerCase().includes('sign in to continue') || errorMessage.toLowerCase().includes('anon limit'))
         ) {
            setShowResultLock(true);
            setShowLogin(true);
         }

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
         {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

         <div className="max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-12">
               <h1 className="font-serif text-5xl md:text-6xl font-semibold text-gray-800 mb-2 italic">
                  Makeup Atelier
               </h1>
               <p className="text-gray-500 tracking-[0.3em] text-sm uppercase">
                  Virtual Try-On
               </p>
               {user && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                     <div className="bg-sage-100 text-sage-700 px-4 py-2 rounded-full text-sm font-medium">
                        ✓ Signed in • Unlimited tries
                     </div>
                     <button
                        onClick={() => {
                           if (confirm('Are you sure you want to sign out?')) {
                              signOut();
                           }
                        }}
                        className="text-sm text-gray-400 hover:text-gray-600 underline"
                     >
                        Sign out
                     </button>
                  </div>
               )}
            </div>

            {/* Upload Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
               {/* Product */}
               <div className="bg-white rounded-2xl p-6 card-shadow">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="flex items-center justify-center w-8 h-8 rounded-full bg-coral-400 text-white text-sm font-semibold">1</span>
                     <h2 className="text-xl font-semibold text-gray-800">Choose a Product</h2>
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
                     <h2 className="text-xl font-semibold text-gray-800">Your Photo</h2>
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
            <div className="flex flex-col items-center mb-12">
               <p className="text-gray-500 text-sm mb-3">Realistic results in seconds</p>
               <Button
                  size="lg"
                  disabled={!tryOnLipstick || !tryOnSelfie}
                  isLoading={loading.isGenerating}
                  onClick={handleTryOn}
                  icon={<Sparkles size={20} />}
                  className="px-12 py-4 text-lg rounded-full bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {loading.isGenerating ? "Applying Makeup..." : "See It On You"}
               </Button>
               {!user && freeTriesUsed < ANON_TRIES_LIMIT && (
                  <p className="text-gray-400 text-sm mt-3">No signup required for your first look</p>
               )}
            </div>

            {/* Result */}
            {tryOnResult && (
               <div className="animate-slide-up">
                  <div className="flex items-center gap-4 mb-2">
                     <div className="h-px bg-coral-300/50 flex-1"></div>
                     <h3 className="font-serif text-2xl font-semibold text-gray-800 italic">This Is How It Looks On You</h3>
                     <div className="h-px bg-coral-300/50 flex-1"></div>
                  </div>
                  <p className="text-center text-gray-400 text-sm mb-6">Compare shades. Save looks. Decide confidently.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-3xl p-6 md:p-8 card-shadow relative">
                     <div className="space-y-3">
                        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest">Original</p>
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200">
                           <img src={tryOnSelfie!} className="w-full h-full object-cover" alt="Original" />
                        </div>
                     </div>

                     <div className="space-y-3 relative">
                        <p className="text-center text-sm font-semibold text-coral-500 uppercase tracking-widest">Result</p>
                        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-coral-400 shadow-lg group">
                           <img src={tryOnResult} className={`w-full h-full object-cover ${showResultLock && !user ? 'blur-sm' : ''}`} alt="Result" />

                           {(!showResultLock || user) && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-6">
                                 <a href={tryOnResult} download="makeup-try-on.png" className="w-full">
                                    <Button size="md" className="w-full bg-white text-gray-800 hover:bg-gray-100" icon={<Download size={18} />}>
                                       Save Image
                                    </Button>
                                 </a>
                              </div>
                           )}

                           {/* Lock Overlay - only show if not logged in */}
                           {showResultLock && !user && (
                              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                                 <div className="bg-coral-100 rounded-full p-4 mb-4">
                                    <Lock className="w-8 h-8 text-coral-500" />
                                 </div>
                                 <h4 className="text-xl font-semibold text-gray-800 mb-2">Save and Compare Your Looks</h4>
                                 <p className="text-gray-600 mb-1">You've reached the preview limit.</p>
                                 <p className="text-gray-600 mb-6">Create an account to save results, compare shades, and continue trying.</p>
                                 <Button
                                    size="lg"
                                    onClick={() => setShowLogin(true)}
                                    className="bg-coral-500 text-white hover:bg-coral-600 mb-3"
                                 >
                                    Continue & Save My Results
                                 </Button>
                                 <button
                                    onClick={() => setShowResultLock(false)}
                                    className="text-sm text-gray-400 hover:text-gray-600 underline"
                                 >
                                    I don't want to save my looks
                                 </button>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            )}

         </div>
      </div>
   );
}
