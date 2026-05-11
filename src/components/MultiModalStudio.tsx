import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Upload, Settings2, Download, RefreshCw, X, Play, Sparkles, BookOpen, Trash2, AlertCircle } from 'lucide-react';

interface MultiModalStudioProps {
  theme: 'light' | 'dark';
  onAddAssetToNarrative?: (asset: MediaAsset) => void;
  credits: number;
  userId: string;
  isAdmin: boolean;
}

const GENERATION_COSTS: Record<GenerationMode, number> = {
  image: 10,
  video: 40,
  music: 40
};

type GenerationMode = 'image' | 'video' | 'music';

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  source: 'uploaded' | 'generated';
  name: string;
  url?: string;
  model?: string;
  timestamp: string;
  metadata?: any;
}

export function MultiModalStudio({ theme, onAddAssetToNarrative, credits, userId, isAdmin }: MultiModalStudioProps) {
  const [activeMode, setActiveMode] = useState<GenerationMode>('image');
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [resolution, setResolution] = useState<string>("1080p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([
    {
      id: 'mock-1',
      type: 'image',
      source: 'uploaded',
      name: 'reference_logo.png',
      timestamp: new Date().toISOString()
    }
  ]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);

    const cost = GENERATION_COSTS[activeMode];
    if (!isAdmin && credits < cost) {
      setError(`Insufficient Credits: Generation requires ${cost} credits. You have ${credits}.`);
      return;
    }

    setIsGenerating(true);

    let finalUrl: string | undefined = undefined;
    let modelUsed = "";

    try {
      if (!isAdmin) {
        // Deduct credits via Firestore transaction
        // Importing db here to avoid dependency issues if needed, but it's better to expect it in lib/firebase
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { doc, runTransaction, collection, serverTimestamp } = await import('firebase/firestore');
        
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User record not found");
          const currentCredits = userDoc.data().credits || 0;
          if (currentCredits < cost) throw new Error(`Insufficient credits`);
          
          transaction.update(userRef, { credits: currentCredits - cost });
          
          // Log activity
          const activityRef = doc(collection(db, 'users', userId, 'activity'));
          transaction.set(activityRef, {
            type: `${activeMode}_generation`,
            description: `${activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Synthesis`,
            cost: cost,
            timestamp: serverTimestamp(),
            metadata: {
              prompt: prompt.substring(0, 500)
            }
          });
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          throw err;
        });
      }

      if (activeMode === 'music') {
        const apiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY || 'sk_5bdf15ff04861db538ef1bb3d49e71f4c49269829297ff0d';
        modelUsed = "ElevenLabs";
        const response = await fetch('https://api.elevenlabs.io/v1/music', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({ prompt: prompt })
        });

        if (response.ok) {
          const blob = await response.blob();
          finalUrl = URL.createObjectURL(blob);
        } else {
          const errText = await response.text();
          throw new Error(`ElevenLabs Music Generation failed: ${errText}`);
        }
      } else if (activeMode === 'image' || activeMode === 'video') {
        const { GoogleGenAI } = await import("@google/genai");
        
        // Paid model check
        if (typeof (window as any).aistudio !== 'undefined') {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
          }
        }
        
        // Ensure we use the most up-to-date API key (often GEMINI_API_KEY or API_KEY in this env)
        const apiKey = (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
        if (!apiKey) throw new Error("Gemini API Key is required for synthesis.");
        const genAI = new GoogleGenAI({ apiKey });

        if (activeMode === 'image') {
          modelUsed = "Gemini 2.5 Flash Image";
          const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              imageConfig: {
                aspectRatio: aspectRatio as any,
              }
            }
          });
          
          const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (imagePart?.inlineData?.data) {
            finalUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          } else {
            throw new Error("No image data returned. Ensure Imagen API is enabled.");
          }
        } else if (activeMode === 'video') {
          modelUsed = "Veo 3.1";
          let operation = await genAI.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: prompt,
            config: {
              numberOfVideos: 1,
              resolution: resolution as any,
              aspectRatio: aspectRatio as any
            }
          });

          // Polling for video completion
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await genAI.operations.getVideosOperation({ operation });
          }

          const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!downloadLink) throw new Error("Video synthesis failed to return a valid stream URI.");

          // Fetch video using API key in header as per skill guidelines
          const videoResponse = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': apiKey,
            },
          });

          if (!videoResponse.ok) throw new Error("Failed to secure kinetic stream from synthesized URI.");
          const blob = await videoResponse.blob();
          finalUrl = URL.createObjectURL(blob);
        }
      }
      
      const newAsset: MediaAsset = {
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: activeMode === 'music' ? 'audio' : activeMode,
        source: 'generated',
        name: `${activeMode}_generation_${prompt.substring(0, 10)}.${activeMode === 'music' ? 'mp3' : activeMode === 'image' ? 'png' : 'mp4'}`,
        model: modelUsed,
        timestamp: new Date().toISOString(),
        metadata: { prompt },
        url: finalUrl
      };
      
      setAssets(prev => [newAsset, ...prev]);
      setPrompt("");
    } catch (err: any) {
      console.error(`Generation error (${activeMode}):`, err);
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getModelBadgeColors = (type: GenerationMode) => {
    switch (type) {
      case 'image': return 'from-purple-500 to-indigo-600 border-indigo-500 text-indigo-50';
      case 'video': return 'from-teal-400 to-cyan-600 border-teal-500 text-cyan-50';
      case 'music': return 'from-amber-400 to-orange-600 border-orange-500 text-orange-50';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const getBorderColor = (asset: MediaAsset) => {
    if (asset.source === 'uploaded') return theme === 'dark' ? 'border-[#333]' : 'border-gray-200';
    if (asset.type === 'image') return 'border-indigo-500 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]';
    if (asset.type === 'video') return 'border-teal-500 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)]';
    if (asset.type === 'audio') return 'border-orange-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]';
    return '';
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
      {/* Studio Header */}
      <div className={`p-3 md:p-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4`}>
        <div>
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none">Synthesis Studio</h2>
          <p className="text-[8px] md:text-xs font-mono opacity-60 uppercase tracking-widest mt-1">Multi-Modal Environment</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
          {(['image', 'video', 'music'] as GenerationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-3 md:px-4 py-1.5 md:py-2 border-2 text-[10px] md:text-sm font-bold uppercase transition-all flex items-center gap-2 shrink-0 ${
                activeMode === mode 
                  ? theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'
                  : theme === 'dark' ? 'border-[#333] hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {mode === 'image' && <ImageIcon className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'video' && <Video className="w-3 h-3 md:w-4 md:h-4" />}
              {mode === 'music' && <Music className="w-3 h-3 md:w-4 md:h-4" />}
              <span className={mode === activeMode ? 'inline' : 'hidden md:inline'}>{mode}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Console - Generation controls */}
        <div className={`w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-gray-50'} p-4 md:p-6 flex flex-col lg:h-auto max-h-[100vh] lg:max-h-none`}>
          <div className="flex items-center gap-2 mb-4 md:mb-6 shrink-0">
            <Wand2 className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
            <h3 className="font-bold uppercase tracking-widest text-[10px] md:text-sm">Composer Parameters</h3>
          </div>

          <div className="flex-1 space-y-4 md:space-y-6 overflow-y-auto min-h-0 pr-1 md:pr-4 history-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-mono uppercase opacity-60 font-bold block">Master Prompt</label>
              <textarea 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`Describe the ${activeMode} you want to synthesize...`}
                className={`w-full p-3 md:p-4 border resize-none h-24 md:h-32 font-mono text-xs md:text-sm focus:outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] focus:border-white' 
                    : 'bg-white border-gray-300 focus:border-black'
                }`}
              />
            </div>

            {error && (
              <div className="p-4 border-2 border-red-500/20 bg-red-500/5 text-red-500 text-[10px] font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Mock Advanced Settings based on mode */}
            <div className={`p-4 border ${theme === 'dark' ? 'border-[#333] bg-black/20' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 opacity-50" />
                <span className="text-xs uppercase font-bold tracking-widest">Model Config</span>
              </div>
              
              <div className="space-y-4">
                {activeMode === 'image' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio}
                        onChange={e => setAspectRatio(e.target.value)}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <option value="1:1">1:1 Square</option>
                        <option value="4:3">4:3 Ratio</option>
                        <option value="3:4">3:4 Ratio</option>
                        <option value="16:9">16:9 Wide</option>
                        <option value="9:16">9:16 Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Style</label>
                      <select className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                        <option>Photorealistic</option>
                        <option>Cinematic</option>
                        <option>Digital Art</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'video' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Aspect Ratio</label>
                      <select 
                        value={aspectRatio === '1:1' ? '16:9' : aspectRatio} // Veo prefers 16:9 or 9:16
                        onChange={e => setAspectRatio(e.target.value)}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <option value="16:9">16:9 Landscape</option>
                        <option value="9:16">9:16 Portrait</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Resolution</label>
                      <select 
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="4k">4K Ultra HD</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {activeMode === 'music' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Genre</label>
                      <select className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                        <option>Synthwave</option>
                        <option>Cinematic Orchestral</option>
                        <option>Lo-Fi Chill</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Vocals</label>
                      <select className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                        <option>Instrumental</option>
                        <option>Female Vocals</option>
                        <option>Male Vocals</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full p-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-6 flex-shrink-0 ${
              isGenerating 
                ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white' 
                : `bg-gradient-to-r ${getModelBadgeColors(activeMode)} shadow-lg hover:shadow-xl hover:-translate-y-0.5`
            }`}
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            <div className="flex flex-col items-center">
              <span>{isGenerating ? 'Synthesizing...' : `Generate ${activeMode}`}</span>
              {!isGenerating && (
                <span className="text-[10px] opacity-60 font-mono tracking-tighter">
                  -{GENERATION_COSTS[activeMode]} CREDITS
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Right Console - Assets Grid */}
        <div className={`flex-1 p-4 md:p-8 overflow-y-auto ${theme === 'dark' ? 'bg-[#111]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <h3 className="font-black uppercase tracking-widest text-lg flex items-center gap-3">
                <Upload className="w-5 h-5 opacity-60" />
                Synthesis Library
              </h3>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em] mt-1">Stored generations and uploads</p>
            </div>
            <div className="px-3 py-1 border-2 font-mono text-xs font-bold tracking-widest uppercase opacity-60">
              {assets.length} Entry_Points
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 pb-12">
            <AnimatePresence>
              {assets.map((asset) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  className={`border-4 flex flex-col transition-all overflow-hidden relative group shadow-2xl h-full ${
                     theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-white'
                  } ${getBorderColor(asset)}`}
                >
                  {/* Decorative badge for generated content */}
                  {asset.source === 'generated' && (
                    <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`} />
                  )}

                  <div className="relative aspect-video flex-shrink-0 flex items-center justify-center overflow-hidden bg-black/40">
                    {/* Media Type Specific Preview */}
                    {asset.type === 'image' && (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <ImageIcon className="w-16 h-16 opacity-10 absolute z-0" />
                        <div className="z-10 text-[10px] font-mono tracking-widest uppercase opacity-40">Synthesized_Visual_Data</div>
                      </div>
                    )}
                    {asset.type === 'video' && (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <Video className="w-16 h-16 opacity-10 absolute z-0" />
                        <div className="z-10 text-[10px] font-mono tracking-widest uppercase opacity-40">Kinetic_Sequence_Buffer</div>
                      </div>
                    )}
                    {asset.type === 'audio' && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-4 bg-gradient-to-br from-orange-500/5 to-transparent">
                        <Music className="w-12 h-12 opacity-20" />
                        {asset.url && (
                          <audio src={asset.url} controls className="w-full max-w-[240px] h-8 grayscale opacity-60 hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className={`absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-all duration-300 backdrop-blur-md`}>
                       <button className="flex flex-col items-center gap-2 p-3 hover:text-white transition-colors">
                         <div className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                           <Play className="w-5 h-5" />
                         </div>
                         <span className="text-[10px] font-mono uppercase tracking-widest">Observe</span>
                       </button>
                       <button className="flex flex-col items-center gap-2 p-3 hover:text-white transition-colors">
                         <div className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                           <Download className="w-5 h-5" />
                         </div>
                         <span className="text-[10px] font-mono uppercase tracking-widest">Extract</span>
                       </button>
                    </div>
                  </div>

                  <div className={`p-6 flex-1 flex flex-col border-t ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex flex-col min-w-0 pr-4">
                         <span className="font-black text-sm truncate uppercase tracking-tight" title={asset.name}>{asset.name}</span>
                         <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest mt-1">
                           {new Date(asset.timestamp).toLocaleDateString()} // {new Date(asset.timestamp).toLocaleTimeString()}
                         </span>
                       </div>
                       
                       {asset.source === 'uploaded' ? (
                         <div className="px-2 py-0.5 text-[8px] uppercase font-mono font-black tracking-widest border-2 border-current rounded-none opacity-40 flex-shrink-0">
                           USR_RAW
                         </div>
                       ) : (
                         <div className={`px-2 py-0.5 text-[8px] uppercase font-mono font-black tracking-widest rounded-none bg-gradient-to-r flex-shrink-0 ${getModelBadgeColors(asset.type as GenerationMode)}`}>
                           {asset.model}
                         </div>
                       )}
                    </div>

                    {asset.source === 'generated' && asset.metadata && (
                       <div className={`p-4 text-[11px] font-mono italic leading-relaxed mb-6 ${theme === 'dark' ? 'bg-black/40 text-gray-400' : 'bg-gray-50 text-gray-600'} border-l-4 ${getBorderColor(asset).split(' ')[0]} line-clamp-3 relative`} title={asset.metadata.prompt}>
                         <Sparkles className="w-3 h-3 absolute top-2 right-2 opacity-20" />
                         "{asset.metadata.prompt}"
                       </div>
                    )}

                    <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-current/5">
                       {asset.source === 'generated' && (
                         <button 
                            onClick={() => onAddAssetToNarrative?.(asset)}
                            className={`w-full py-3 text-[10px] uppercase font-black tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                              theme === 'dark' ? 'bg-white text-black hover:bg-gray-200 shadow-lg' : 'bg-black text-white hover:bg-gray-800'
                            }`}
                         >
                           <BookOpen className="w-4 h-4" />
                           Add to Narrative Context
                         </button>
                       )}
                       <div className="flex gap-2">
                          <button className={`flex-1 py-2 text-[9px] uppercase font-mono font-bold border ${theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-300 hover:border-black'} transition-colors`}>
                            {asset.source === 'generated' ? 'Remix Logic' : 'Reference'}
                          </button>
                          <button className={`flex-1 py-1 text-[9px] uppercase font-mono font-bold transition-all text-red-500 hover:text-red-400 flex items-center justify-center gap-1`}>
                            <Trash2 className="w-3 h-3" />
                            Purge
                          </button>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
