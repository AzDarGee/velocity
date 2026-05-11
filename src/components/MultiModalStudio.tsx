import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Upload, Settings2, Download, RefreshCw, X, Play } from 'lucide-react';

interface MultiModalStudioProps {
  theme: 'light' | 'dark';
}

type GenerationMode = 'image' | 'video' | 'music';

interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  source: 'uploaded' | 'generated';
  name: string;
  url?: string;
  model?: string;
  timestamp: string;
  metadata?: any;
}

export function MultiModalStudio({ theme }: MultiModalStudioProps) {
  const [activeMode, setActiveMode] = useState<GenerationMode>('image');
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([
    {
      id: 'mock-1',
      type: 'image',
      source: 'uploaded',
      name: 'reference_logo.png',
      timestamp: new Date().toISOString()
    }
  ]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    
    // Mock generation delay
    setTimeout(() => {
      const newAsset: MediaAsset = {
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: activeMode === 'music' ? 'audio' : activeMode,
        source: 'generated',
        name: `${activeMode}_generation_${prompt.substring(0, 10)}.ext`,
        model: activeMode === 'image' ? 'NanoBanana Pro' : activeMode === 'video' ? 'Veo 3.1' : 'Suno',
        timestamp: new Date().toISOString(),
        metadata: { prompt }
      };
      
      setAssets(prev => [newAsset, ...prev]);
      setIsGenerating(false);
      setPrompt("");
    }, 2000);
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
      <div className={`p-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'} flex items-center justify-between`}>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Media Synthesis Studio</h2>
          <p className="text-xs font-mono opacity-60 uppercase tracking-widest mt-1">Multi-Modal Generation Environment</p>
        </div>
        <div className="flex gap-2">
          {(['image', 'video', 'music'] as GenerationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-4 py-2 border-2 text-sm font-bold uppercase transition-all flex items-center gap-2 ${
                activeMode === mode 
                  ? theme === 'dark' ? 'border-white bg-white text-black' : 'border-black bg-black text-white'
                  : theme === 'dark' ? 'border-[#333] hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {mode === 'image' && <ImageIcon className="w-4 h-4" />}
              {mode === 'video' && <Video className="w-4 h-4" />}
              {mode === 'music' && <Music className="w-4 h-4" />}
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Console - Generation controls */}
        <div className={`w-1/3 border-r ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-gray-200 bg-gray-50'} p-6 flex flex-col`}>
          <div className="flex items-center gap-2 mb-6">
            <Wand2 className="w-5 h-5 opacity-60" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Composer Parameters</h3>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase opacity-60 font-bold block">Master Prompt</label>
              <textarea 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`Describe the ${activeMode} you want to synthesize...`}
                className={`w-full p-4 border resize-none h-32 font-mono text-sm focus:outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-[#1A1A1A] border-[#333] focus:border-white' 
                    : 'bg-white border-gray-300 focus:border-black'
                }`}
              />
            </div>
            
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
                      <select className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                        <option>16:9 Landscape</option>
                        <option>1:1 Square</option>
                        <option>9:16 Vertical</option>
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
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Motion Strength</label>
                      <input type="range" className="w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono opacity-60 mb-1 block">Duration</label>
                      <select className={`w-full p-2 border text-xs font-mono ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                        <option>5 Seconds</option>
                        <option>10 Seconds</option>
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
            className={`w-full p-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
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
            {isGenerating ? 'Synthesizing...' : `Generate ${activeMode}`}
          </button>
        </div>

        {/* Right Console - Assets Grid */}
        <div className={`flex-1 p-6 overflow-y-auto ${theme === 'dark' ? 'bg-[#111]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 opacity-60" />
              Asset Library
            </h3>
            <div className="text-xs font-mono opacity-60 uppercase">
              {assets.length} Item(s)
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {assets.map((asset) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`border-2 flex flex-col transition-all overflow-hidden relative group ${
                     theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-gray-50'
                  } ${getBorderColor(asset)}`}
                >
                  {/* Decorative badge for generated content */}
                  {asset.source === 'generated' && (
                    <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`} />
                  )}

                  <div className="p-4 flex-1 flex items-center justify-center min-h-[160px] relative">
                    {/* Placeholder for media content */}
                    {asset.type === 'image' && <ImageIcon className="w-12 h-12 opacity-20" />}
                    {asset.type === 'video' && <Video className="w-12 h-12 opacity-20" />}
                    {asset.type === 'audio' && <Play className="w-12 h-12 opacity-20" />}
                    
                    {/* Hover Actions overlay */}
                    <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity backdrop-blur-sm`}>
                       <button className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md">
                         <Play className="w-4 h-4" />
                       </button>
                       <button className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md">
                         <Download className="w-4 h-4" />
                       </button>
                    </div>
                  </div>

                  <div className={`p-4 border-t ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <span className="font-bold text-sm truncate pr-2" title={asset.name}>{asset.name}</span>
                       
                       {/* Distinguish Uploaded vs Generated */}
                       {asset.source === 'uploaded' ? (
                         <span className="px-2 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest border border-current rounded-sm opacity-60">
                           User_Upload
                         </span>
                       ) : (
                         <span className={`px-2 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest rounded-sm bg-gradient-to-r ${getModelBadgeColors(asset.type as GenerationMode)}`}>
                           {asset.model}
                         </span>
                       )}
                    </div>
                    
                    <div className="text-[10px] font-mono opacity-50 mb-3 block">
                       {new Date(asset.timestamp).toLocaleTimeString()}
                    </div>

                    {asset.source === 'generated' && asset.metadata && (
                       <div className={`p-2 text-xs font-mono italic ${theme === 'dark' ? 'bg-black/30' : 'bg-black/5'} border-l-2 ${getBorderColor(asset).split(' ')[0]} line-clamp-2`} title={asset.metadata.prompt}>
                         "{asset.metadata.prompt}"
                       </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-current/10">
                       {asset.source === 'generated' ? (
                         <>
                           <button className="flex-1 py-1 text-[10px] uppercase font-mono font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Remix</button>
                           <button className="flex-1 py-1 text-[10px] uppercase font-mono font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Use as Ref</button>
                         </>
                       ) : (
                         <button className="w-full py-1 text-[10px] uppercase font-mono font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-red-500 hover:text-red-600">Remove</button>
                       )}
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
