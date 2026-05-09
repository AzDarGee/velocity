import { motion, AnimatePresence } from "motion/react";
import { X, Download, Copy, Check, Type, FileAudio, FileText } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface MediaFile {
  id: string;
  name?: string;
  mimeType?: string;
  previewUrl?: string;
  firestoreId?: string;
  type?: 'video' | 'audio' | 'image';
  size?: number;
  storageUrl?: string;
  file?: File;
  uri?: string;
  extractedText?: string;
}

interface GenerationViewerProps {
  content: string;
  title: string;
  theme: 'light' | 'dark';
  isAdmin: boolean;
  mediaFiles: MediaFile[];
  onClose: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onDownloadAsset?: (file: MediaFile) => void;
}

export function GenerationViewer({ content, title, theme, isAdmin, mediaFiles, onClose, onDownload, onCopy, onDownloadAsset }: GenerationViewerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [showAssets, setShowAssets] = useState(false);

  const handleCopy = () => {
    onCopy();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex flex-col ${theme === 'dark' ? 'bg-[#0A0A0A] text-white' : 'bg-[#F8F8F7] text-black'}`}
    >
      <header className={`h-20 border-b flex items-center justify-between px-8 ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-[#141414] bg-white'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 border-2 flex items-center justify-center ${theme === 'dark' ? 'border-white bg-white' : 'border-black bg-black'}`}>
             <Type className={`w-5 h-5 ${theme === 'dark' ? 'text-black' : 'text-white'}`} />
          </div>
          <div>
            <h1 className="font-serif italic text-xl leading-none">Reading_Mode</h1>
            <p className="text-[10px] uppercase font-mono tracking-widest opacity-50 mt-1">{title || "Untitled_Synthesis"}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowAssets(!showAssets)}
              className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] uppercase font-bold tracking-widest transition-all ${
                theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black font-semibold' : 'border-[#141414] hover:bg-black hover:text-white'
              } ${showAssets ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white') : ''}`}
            >
              <Download className="w-4 h-4" />
              Source Assets ({mediaFiles.length})
            </button>
            
            <AnimatePresence>
              {showAssets && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute top-full right-0 mt-2 w-72 border-2 p-2 z-[110] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-[#1A1A1A] border-[#333]' : 'bg-white border-[#141414]'}`}
                >
                  <div className="space-y-1">
                    {mediaFiles.length === 0 ? (
                      <p className="text-[10px] font-mono opacity-40 p-4 text-center">No assets found for this synthesis.</p>
                    ) : (
                      mediaFiles.map((m) => (
                        <div key={m.id} className={`flex items-center justify-between p-2 border border-transparent hover:border-current transition-colors group/asset ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                          <div className="flex flex-col min-w-0 flex-1 mr-2">
                             <span className="text-[10px] font-bold truncate uppercase">{m.name}</span>
                             <span className="text-[8px] opacity-40 font-mono">{( (m.size || 0) / (1024 * 1024)).toFixed(2)}MB</span>
                          </div>
                          <button 
                            onClick={() => onDownloadAsset?.(m)}
                            className={`p-1.5 border border-current opacity-40 hover:opacity-100 transition-all ${theme === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'}`}
                            title="Download Asset"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] uppercase font-bold tracking-widest transition-all ${
              theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black font-semibold' : 'border-[#141414] hover:bg-black hover:text-white'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {isCopied ? "Copied" : "Copy Source"}
          </button>
          
          <button 
            onClick={onDownload}
            className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] uppercase font-bold tracking-widest transition-all ${
              theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black font-semibold' : 'border-[#141414] hover:bg-black hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>

          <button 
            onClick={onClose}
            className={`p-2 border-2 transition-colors ${theme === 'dark' ? 'border-[#333] text-white hover:bg-white hover:text-black' : 'border-[#141414] text-black hover:bg-black hover:text-white'}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto history-scrollbar p-8 md:p-20 flex justify-center">
        <article className="max-w-3xl w-full">
          <div className={`prose ${theme === 'dark' ? 'prose-invert' : 'prose-neutral'} prose-headings:font-serif prose-headings:italic prose-p:font-sans prose-p:leading-relaxed selection:bg-yellow-200 selection:text-black`}>
            <Markdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, children, ...props }) => {
                  const hasMedia = (node?.children as any)?.some((child: any) => 
                    child.tagName === "img" && child.properties?.src?.startsWith("MEDIA_ID_")
                  );
                  if (hasMedia) return <div className="mb-10 w-full" {...props}>{children}</div>;
                  return <p className="text-lg leading-relaxed mb-6" {...props}>{children}</p>;
                },
                img: ({ node, src, alt, ...props }) => {
                  if (src?.startsWith('MEDIA_ID_')) {
                    const id = src.replace('MEDIA_ID_', '');
                    const media = mediaFiles.find(m => m.id === id || m.firestoreId === id);
                    if (media && media.previewUrl) {
                      const type = media.mimeType || media.type || '';
                      const name = media.name || 'Asset';

                      if (type.includes('image')) {
                        return (
                          <div className="group my-12 space-y-4">
                            <div className="relative overflow-hidden">
                              <img 
                                src={media.previewUrl} 
                                alt={alt || name} 
                                referrerPolicy="no-referrer"
                                className={`w-full rounded-sm border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] transition-transform duration-700 group-hover:scale-[1.02]`} 
                              />
                              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%] opacity-20" />
                              <div className={`absolute top-0 left-0 px-2 py-1 text-[8px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                Visual_Asset_Ingested
                              </div>
                            </div>
                            <p className="text-[10px] font-mono opacity-40 uppercase text-center italic tracking-widest">— {alt || name}</p>
                          </div>
                        );
                      }
                      if (type.includes('video')) {
                        return (
                          <div className="my-14 space-y-4">
                            <div className={`relative border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} bg-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]`}>
                              <video src={media.previewUrl} controls className="w-full aspect-video" crossOrigin="anonymous" />
                              <div className={`absolute top-0 right-0 px-2 py-1 text-[8px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                Motion_Data_Stream
                              </div>
                            </div>
                            <p className="text-[10px] font-mono opacity-40 uppercase text-center italic tracking-widest">— Video Extraction: {alt || name}</p>
                          </div>
                        );
                      }
                      if (type.includes('audio')) {
                        return (
                          <div className={`my-12 p-8 border-2 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-[#F8F8F7] border-black'} rounded-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] relative overflow-hidden group`}>
                            <div className="flex items-center gap-6 mb-8">
                              <div className={`w-12 h-12 flex items-center justify-center transition-transform group-hover:rotate-12 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                                <FileAudio className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="block text-[10px] font-mono opacity-40 uppercase tracking-widest mb-1.5">Narrative_Audio_Asset</span>
                                <span className="block text-sm font-bold uppercase tracking-tight">{name}</span>
                              </div>
                            </div>
                            <audio src={media.previewUrl} controls className="w-full h-12" crossOrigin="anonymous" />
                          </div>
                        );
                      }
                      // Document Card for GenerationViewer
                      const isPdf = type.includes('pdf');
                      return (
                        <div className={`my-12 relative border-2 p-8 flex items-center gap-6 transition-all ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-black bg-white'}`}>
                           <div className={`w-16 h-16 flex items-center justify-center border-2 ${isPdf ? 'border-red-500/40 bg-red-500/5' : 'border-indigo-500/40 bg-indigo-500/5'}`}>
                             <FileText className={`w-8 h-8 ${isPdf ? 'text-red-500' : 'text-indigo-500'}`} />
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-mono font-bold opacity-40 uppercase tracking-widest">{isPdf ? 'Source_Document_Ref' : 'Source_Data_Node'}</p>
                             <h4 className="text-lg font-bold uppercase truncate">{name}</h4>
                             <p className="text-[10px] font-mono opacity-40">{( (media.size || 0) / (1024 * 1024)).toFixed(2)} MB</p>
                           </div>
                        </div>
                      );
                    }
                    return <div className="p-4 border border-dashed opacity-50 text-center font-mono text-[10px]">Reference_Lost {isAdmin && `: ${id}`}</div>;
                  }
                  return <img src={src} alt={alt} referrerPolicy="no-referrer" className="max-w-full rounded" {...props} />;
                },
                h1: ({ children }) => <h1 className={`text-4xl font-serif italic mb-8 uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{children}</h1>,
                h2: ({ children }) => <h2 className={`text-2xl font-serif italic mt-12 mb-4 border-l-4 border-current pl-4 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{children}</h2>,
                h3: ({ children }) => <h3 className={`text-xl font-bold mt-8 mb-3 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className={`my-8 pl-6 border-l-4 py-2 italic font-serif text-lg leading-relaxed ${theme === 'dark' ? 'border-white/20 text-white/70' : 'border-black/20 text-black/70'}`}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </Markdown>
          </div>
        </article>
      </main>

      <footer className={`h-12 border-t flex items-center justify-center ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A] text-white/30' : 'border-[#141414] bg-white text-black/30'}`}>
        <p className="text-[10px] uppercase font-mono tracking-[0.3em]">Velocity Synthesis Protocol // End of Transcript</p>
      </footer>
    </motion.div>
  );
}
