import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Upload, Settings2, Download, RefreshCw, X, Play, Sparkles, BookOpen, Trash2, AlertCircle, Check } from 'lucide-react';

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

const DEFAULT_STYLES = [
  "Pop", "Rock", "Hip Hop", "R&B", "Country", 
  "Jazz", "Classical", "Electronic", "Dance", "Folk",
  "Acoustic", "Blues", "Soul", "Funk", "Disco",
  "Reggae", "Latin", "Metal", "Punk", "Indie Rock",
  "Alternative", "Synthwave", "Ambient", "Cinematic", "Lo-Fi",
  "Trap", "EDM", "House", "Techno", "K-Pop"
];

export function MultiModalStudio({ theme, onAddAssetToNarrative, credits, userId, isAdmin }: MultiModalStudioProps) {
  const [activeMode, setActiveMode] = useState<GenerationMode>('image');
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [resolution, setResolution] = useState<string>("1080p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sunoCustomMode, setSunoCustomMode] = useState(false);
  const [sunoInstrumental, setSunoInstrumental] = useState(false);
  const [sunoModel, setSunoModel] = useState("V4_5ALL");
  const [sunoStyles, setSunoStyles] = useState<string[]>([]);
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [newStyle, setNewStyle] = useState("");
  const [sunoTitle, setSunoTitle] = useState("");
  const [sunoPersonaId, setSunoPersonaId] = useState("");
  const [sunoPersonaModel, setSunoPersonaModel] = useState("");
  const [sunoNegativeTags, setSunoNegativeTags] = useState("");
  const [sunoVocalGender, setSunoVocalGender] = useState("");
  const [sunoStyleWeight, setSunoStyleWeight] = useState<number>(0.65);
  const [sunoWeirdnessConstraint, setSunoWeirdnessConstraint] = useState<number>(0.65);
  const [sunoAudioWeight, setSunoAudioWeight] = useState<number>(0.65);
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

    const startTime = Date.now();

    let finalUrl: string | undefined = undefined;
    let modelUsed = "";
    let finalMetadata: any = { prompt };

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
        const apiKey = (import.meta as any).env.VITE_SUNO_API_KEY;
        if (!apiKey) {
          throw new Error('VITE_SUNO_API_KEY environment variable is required to generate music with Suno AI.');
        }
        modelUsed = "Suno AI";
        const payload: any = {
          prompt: prompt,
          customMode: sunoCustomMode,
          instrumental: sunoInstrumental,
          model: sunoModel,
          title: sunoTitle || "Generated Track",
          style: sunoStyles.join(", ") || (sunoInstrumental ? "Instrumental" : ""),
          callBackUrl: window.location.origin + "/api/suno-callback",
          wait_audio: true 
        };

        if (sunoPersonaId) payload.personaId = sunoPersonaId;
        if (sunoPersonaModel) payload.personaModel = sunoPersonaModel;
        if (sunoNegativeTags) payload.negativeTags = sunoNegativeTags;
        if (sunoVocalGender) payload.vocalGender = sunoVocalGender;
        if (sunoStyleWeight !== 0.65) payload.styleWeight = sunoStyleWeight;
        if (sunoWeirdnessConstraint !== 0.65) payload.weirdnessConstraint = sunoWeirdnessConstraint;
        if (sunoAudioWeight !== 0.65) payload.audioWeight = sunoAudioWeight;

        const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Suno AI Music Generation failed: ${errText}`);
        }

        const jsonRes = await response.json();
        
        if (jsonRes.code && jsonRes.code !== 200) {
           throw new Error(`Suno AI Music Generation failed: ${jsonRes.msg || JSON.stringify(jsonRes)}`);
        }

        const taskId = jsonRes?.data?.taskId || jsonRes?.taskId || (Array.isArray(jsonRes.data) && jsonRes.data[0]?.task_id) || jsonRes?.data?.task_id;
        if (!taskId) {
            throw new Error("Could not find taskId in Suno AI response: " + JSON.stringify(jsonRes));
        }

        let sunoItem = null;
        let attempts = 0;
        while(attempts < 120) { // 2 minutes max
           await new Promise(r => setTimeout(r, 2000));
           const statusRes = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
               headers: {
                  'Authorization': `Bearer ${apiKey}`
               }
           });
           if (!statusRes.ok) continue;
           const statusData = await statusRes.json();
           const status = statusData?.data?.status;
           if (status === 'SUCCESS') {
               const items = statusData?.data?.response?.sunoData;
               if (items && items.length > 0) {
                   sunoItem = items[0];
                   break;
               }
           } else if (status && (status.includes('FAIL') || status.includes('ERROR') || status.includes('EXCEPTION'))) {
               throw new Error(`Suno AI generation failed with status: ${status}. Message: ${statusData?.data?.errorMessage || 'Unknown error'}`);
           }
           attempts++;
        }

        if (!sunoItem || (!sunoItem.audioUrl && !sunoItem.streamAudioUrl && !sunoItem.audio_url)) {
             throw new Error("Timeout or could not find audio metadata in Suno AI task results.");
        }

        const audioUrl = sunoItem.audioUrl || sunoItem.streamAudioUrl || sunoItem.audio_url;
        
        finalMetadata = { prompt, ...sunoItem };

        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error("Failed to download generated audio from Suno URL");
        const blob = await audioRes.blob();
        finalUrl = URL.createObjectURL(blob);
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
      
      const endTime = Date.now();
      finalMetadata.generationTimeMs = endTime - startTime;

      const newAsset: MediaAsset = {
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: activeMode === 'music' ? 'audio' : activeMode,
        source: 'generated',
        name: `${activeMode}_generation_${prompt.substring(0, 10)}.${activeMode === 'music' ? 'mp3' : activeMode === 'image' ? 'png' : 'mp4'}`,
        model: modelUsed,
        timestamp: new Date().toISOString(),
        metadata: finalMetadata,
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
                  <div className="flex flex-col gap-8 mt-2">
                    {/* Primary Controls */}
                    <div className={`p-5 border-2 transition-colors ${theme === 'dark' ? 'bg-[#141414] border-[#333]' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className="flex flex-col gap-5 mb-5">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Model</label>
                          <select 
                            value={sunoModel}
                            onChange={e => setSunoModel(e.target.value)}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-[#F8F8F7]' : 'bg-white border-gray-300 text-black'}`}
                          >
                            <option value="V5_5">V5.5 Customized</option>
                            <option value="V5">V5 Latest</option>
                            <option value="V4_5ALL">V4.5 ALL</option>
                            <option value="V4_5PLUS">V4.5 PLUS</option>
                            <option value="V4_5">V4.5</option>
                            <option value="V4">V4 Improved</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={sunoCustomMode}
                              onChange={e => setSunoCustomMode(e.target.checked)}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Custom Mode</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={sunoInstrumental}
                              onChange={e => setSunoInstrumental(e.target.checked)}
                              className={`w-4 h-4 cursor-pointer accent-black ${theme === 'dark' ? 'bg-black border-[#333]' : ''}`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-widest group-hover:opacity-100 opacity-80 transition-opacity">Instrumental</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 pt-5 border-t border-current/10">
                        <div>
                          <label className="text-[10px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Song Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Neon Horizon"
                            value={sunoTitle}
                            onChange={e => setSunoTitle(e.target.value)}
                            className={`w-full p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'}`}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase font-mono opacity-60 tracking-wider">Style / Genre [{sunoStyles.length}]</label>
                            {sunoStyles.length > 0 && (
                              <button 
                                onClick={() => setSunoStyles([])}
                                className={`text-[9px] font-mono hover:opacity-100 opacity-60 uppercase transition-opacity ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                              >
                                De-select All
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2 mb-2">
                            <input 
                              type="text"
                              value={newStyle}
                              onChange={(e) => setNewStyle(e.target.value)}
                              placeholder="Add custom style (comma-separated)..."
                              className={`flex-1 p-2.5 border text-[11px] font-mono outline-none focus:border-current transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] placeholder-[#555]' : 'bg-white border-gray-300 placeholder-gray-400'}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newStyle.trim()) {
                                  e.preventDefault();
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                            />
                            <button 
                              onClick={() => {
                                if (newStyle.trim()) {
                                  const vals = newStyle.split(',').map(v => v.trim()).filter(Boolean);
                                  let addedStyles = [...customStyles];
                                  let selectedStyles = [...sunoStyles];
                                  vals.forEach(val => {
                                    if (!addedStyles.includes(val) && !DEFAULT_STYLES.includes(val)) {
                                      addedStyles = [val, ...addedStyles];
                                    }
                                    if (!selectedStyles.includes(val)) {
                                      selectedStyles = [...selectedStyles, val];
                                    }
                                  });
                                  setCustomStyles(addedStyles);
                                  setSunoStyles(selectedStyles);
                                  setNewStyle("");
                                }
                              }}
                              className={`px-1 py-2.5 border text-[11px] font-mono uppercase tracking-widest transition-colors ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333] text-white hover:bg-white hover:text-black' : 'bg-white border-gray-300 text-black hover:bg-black hover:text-white'}`}
                            >
                              Add
                            </button>
                          </div>
                          <div className={`w-full border max-h-40 overflow-y-auto p-4 space-y-3 scrollbar-thin ${
                            theme === 'dark' 
                              ? 'bg-[#0A0A0A] border-[#333] scrollbar-thumb-[#333] scrollbar-track-transparent' 
                              : 'bg-white border-gray-300 scrollbar-thumb-gray-200 scrollbar-track-transparent'
                          }`}>
                            {Array.from(new Set([...customStyles, ...DEFAULT_STYLES])).map((style, idx) => (
                              <label key={`style-seg-${style}`} className="flex items-center gap-3 cursor-pointer group/item">
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox"
                                    checked={sunoStyles.includes(style)}
                                    onChange={(e) => {
                                      const newStyleList = e.target.checked 
                                        ? [...sunoStyles, style]
                                        : sunoStyles.filter(a => a !== style);
                                      setSunoStyles(newStyleList);
                                    }}
                                    className={`peer appearance-none w-4 h-4 border transition-colors ${
                                      theme === 'dark' 
                                        ? 'border-[#333] bg-[#141414] checked:bg-white checked:border-white' 
                                        : 'border-gray-300 bg-white checked:bg-black checked:border-black'
                                    }`}
                                  />
                                  <Check className={`w-2.5 h-2.5 absolute opacity-0 peer-checked:opacity-100 pointer-events-none ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
                                </div>
                                <span className={`text-[11px] font-mono transition-colors ${sunoStyles.includes(style) ? 'font-bold' : 'opacity-60 group-hover/item:opacity-100'}`}>
                                  {style}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Controls */}
                    <div className="flex flex-col gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Vocals & Modifiers</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Vocal Gender</label>
                            <select 
                              value={sunoVocalGender}
                              onChange={e => setSunoVocalGender(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}
                            >
                              <option value="">Any</option>
                              <option value="m">Male</option>
                              <option value="f">Female</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Negative Tags</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Heavy Metal"
                              value={sunoNegativeTags}
                              onChange={e => setSunoNegativeTags(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${!sunoCustomMode ? 'opacity-30' : 'opacity-50'}`}>
                            Persona {sunoCustomMode ? '' : '(Custom Mode Only)'}
                          </span>
                        </div>
                        <div className={`grid grid-cols-1 gap-4 transition-opacity ${!sunoCustomMode ? 'opacity-40' : 'opacity-100'}`}>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona ID</label>
                            <input 
                              type="text" 
                              disabled={!sunoCustomMode}
                              placeholder="e.g. persona_123"
                              value={sunoPersonaId}
                              onChange={e => setSunoPersonaId(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none focus:border-current ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333] placeholder-[#555]' : 'bg-gray-50 border-gray-200 placeholder-gray-400'} ${!sunoCustomMode ? 'cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-mono opacity-60 mb-2 block tracking-wider">Persona Model</label>
                            <select 
                              disabled={!sunoCustomMode}
                              value={sunoPersonaModel}
                              onChange={e => setSunoPersonaModel(e.target.value)}
                              className={`w-full p-2 border text-[10px] font-mono outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'} ${!sunoCustomMode ? 'cursor-not-allowed' : ''}`}
                            >
                              <option value="">Default</option>
                              <option value="style_persona">Style</option>
                              {(sunoModel === 'V5' || sunoModel === 'V5_5') && (
                                <option value="voice_persona">Voice</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Weights & Constraints */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-current/10">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Parameters & Weights</span>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Style Weight</span>
                            <span className="font-bold opacity-100">{sunoStyleWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoStyleWeight} onChange={e => setSunoStyleWeight(parseFloat(e.target.value))}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full cursor-pointer`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Weirdness</span>
                            <span className="font-bold opacity-100">{sunoWeirdnessConstraint.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoWeirdnessConstraint} onChange={e => setSunoWeirdnessConstraint(parseFloat(e.target.value))}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full cursor-pointer`}
                          />
                        </div>
                        <div className={`p-4 border ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                          <label className="flex items-center justify-between text-[9px] uppercase font-mono mb-3 tracking-wider">
                            <span className="opacity-70">Audio Weight</span>
                            <span className="font-bold opacity-100">{sunoAudioWeight.toFixed(2)}</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={sunoAudioWeight} onChange={e => setSunoAudioWeight(parseFloat(e.target.value))}
                            className={`w-full h-1 bg-current/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full cursor-pointer`}
                          />
                        </div>
                      </div>
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

        {/* Right Console - Assets File Manager */}
        <div className={`flex-1 flex flex-col overflow-hidden border-l border-t lg:border-t-0 ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-white'}`}>
          <div className={`p-4 md:p-6 lg:p-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
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
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className={`overflow-x-auto border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className={`border-b-2 ${theme === 'dark' ? 'border-[#333] bg-[#141414]' : 'border-gray-200 bg-gray-50'}`}>
                  <tr className="text-[9px] uppercase font-mono tracking-widest opacity-60">
                    <th className="py-4 px-4 font-normal">Asset</th>
                    <th className="py-4 px-4 font-normal">Type & Source</th>
                    <th className="py-4 px-4 font-normal">Details & Metadata</th>
                    <th className="py-4 px-4 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {assets.map((asset) => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`group border-b last:border-b-0 transition-colors ${
                          theme === 'dark' ? 'border-[#222] hover:bg-[#141414]' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        {/* Name and Preview */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 flex-shrink-0 border-2 flex items-center justify-center relative overflow-hidden bg-black/5 dark:bg-white/5 ${getBorderColor(asset).split(' ')[0]}`}>
                              {asset.metadata?.imageUrl && asset.type === 'audio' && (
                                <img src={asset.metadata.imageUrl} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
                              )}
                              {asset.type === 'image' && <ImageIcon className="w-4 h-4 opacity-50 relative z-10" />}
                              {asset.type === 'video' && <Video className="w-4 h-4 opacity-50 relative z-10" />}
                              {asset.type === 'audio' && <Music className="w-4 h-4 opacity-50 relative z-10" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-bold text-sm uppercase tracking-tight truncate max-w-[200px] mb-1" title={asset.name}>{asset.name}</span>
                               <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest">
                                 {new Date(asset.timestamp).toLocaleDateString()} {new Date(asset.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            </div>
                          </div>
                        </td>

                        {/* Type and Source */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-2">
                             <div className={`px-2 py-1 text-[8px] uppercase font-mono font-black tracking-widest border ${getBorderColor(asset).split(' ')[0]}`}>
                               {asset.type}
                             </div>
                             {asset.source === 'uploaded' ? (
                               <div className="text-[9px] uppercase font-mono font-bold tracking-widest opacity-40">
                                 USR_RAW
                               </div>
                             ) : (
                               <div className="flex flex-col">
                                 <div className={`text-[10px] uppercase font-mono font-bold bg-clip-text text-transparent bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`}>
                                   {asset.model}
                                 </div>
                                 {asset.metadata?.generationTimeMs && (
                                   <div className="text-[8px] font-mono opacity-40 mt-0.5">
                                     GEN: {(asset.metadata.generationTimeMs / 1000).toFixed(1)}s
                                   </div>
                                 )}
                               </div>
                             )}
                          </div>
                        </td>

                        {/* Details and Metadata */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start justify-center max-w-[300px]">
                            {asset.type === 'audio' && asset.url && (
                              <div className="mb-2 w-full">
                                <audio src={asset.url} controls className="w-full max-w-[200px] h-7 grayscale opacity-80 hover:opacity-100 transition-opacity mix-blend-luminosity" />
                              </div>
                            )}
                            {asset.source === 'generated' && asset.metadata ? (
                              <div className="flex flex-col gap-1 w-full relative">
                                <span className={`text-[11px] font-mono italic leading-relaxed line-clamp-2 pr-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} title={asset.metadata.prompt}>
                                  "{asset.metadata.prompt}"
                                </span>
                                {(asset.metadata.title || asset.metadata.tags || asset.metadata.duration) && (
                                  <div className="flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-widest opacity-50 mt-1">
                                     {asset.metadata.title && <span>{asset.metadata.title}</span>}
                                     {asset.metadata.duration && <span>• {asset.metadata.duration}s</span>}
                                     {asset.metadata.tags && <span className="truncate max-w-[150px]">• {asset.metadata.tags}</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">No Context Data</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className={`flex items-center justify-end gap-2 transition-opacity ${asset.url ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {asset.source === 'generated' && (
                              <button 
                                onClick={() => onAddAssetToNarrative?.(asset)}
                                className={`p-2 rounded-none border-2 transition-colors group-hover:border-current flex items-center gap-2 ${
                                  theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black hover:border-white' : 'border-gray-200 hover:bg-black hover:text-white hover:border-black'
                                }`}
                                title="Add to Narrative Context"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">Insert</span>
                              </button>
                            )}
                            <button className={`p-2 rounded-none border-2 transition-colors ${
                              theme === 'dark' ? 'border-[#333] hover:border-white' : 'border-gray-200 hover:border-black'
                            }`} title="View / Extract">
                              <Download className="w-3 h-3" />
                            </button>
                            <button className="p-2 rounded-none border-2 border-transparent hover:border-red-500 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Purge Record">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
