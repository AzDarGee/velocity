import { motion, AnimatePresence } from "motion/react";
import { X, Download, Copy, Check, Type, FileAudio, FileText, FileCode, Columns, Save } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import parse, { domToReact } from "html-react-parser";

// Tiptap is retired in favor of ReactQuill for a fully featured toolbar out-of-the-box

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
  onSave?: (updatedContent: string) => Promise<void>;
  generationId?: string; // Add this if you want to know which doc to update in Firestore
}

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'direction': 'rtl' }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean'] // clear formatting button
  ],
};

const QUILL_FORMATS = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
  'list', 'script', 'indent', 'direction',
  'color', 'background', 'align',
  'link', 'image', 'video'
];

// Sub-component for individual media assets inside GenerationViewer
function MediaAsset({ theme, media, alt, onDownloadAsset }: { theme: 'light' | 'dark', media: MediaFile, alt?: string, onDownloadAsset?: (file: MediaFile) => void }) {
  const displayUrl = media.previewUrl || media.storageUrl || media.uri;
  if (!displayUrl) return <div className="p-4 border border-dashed opacity-50 text-center font-mono text-[10px]">Reference_Unplayable: Missing URL</div>;

  const type = media.mimeType || media.type || '';
  const name = media.name || 'Asset';

  if (type.includes('image')) {
    return (
      <div className="group my-8 space-y-4">
        <div className="relative overflow-hidden">
          <img 
            src={displayUrl} 
            alt={alt || name} 
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
      <div className="my-10 space-y-4">
        <div className={`relative border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-black'} bg-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]`}>
          <video src={displayUrl} controls className="w-full aspect-video" crossOrigin="anonymous" />
          <div className={`absolute top-0 right-0 px-2 py-1 text-[8px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
            Motion_Data_Stream
          </div>
          <button 
            onClick={() => onDownloadAsset?.(media)}
            className={`absolute bottom-4 right-4 p-2 transition-all ${theme === 'dark' ? 'bg-white text-black hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-white hover:text-black'}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] font-mono opacity-40 uppercase text-center italic tracking-widest">— Video Extraction: {alt || name}</p>
      </div>
    );
  }

  if (type.includes('audio')) {
    return (
      <div className={`my-8 p-6 border-2 ${theme === 'dark' ? 'bg-[#0A0A0A] border-[#333]' : 'bg-[#F8F8F7] border-black'} rounded-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] relative overflow-hidden group`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 flex items-center justify-center transition-transform group-hover:rotate-12 ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
              <FileAudio className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-mono opacity-40 uppercase tracking-widest mb-1.5">Narrative_Audio_Asset</span>
              <span className="block text-sm font-bold uppercase tracking-tight">{name}</span>
            </div>
          </div>
          <button 
            onClick={() => onDownloadAsset?.(media)}
            className={`p-3 border-2 transition-all ${theme === 'dark' ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <audio src={displayUrl} controls className="w-full h-12" crossOrigin="anonymous" />
      </div>
    );
  }

  const isPdf = type.includes('pdf');
  return (
    <div className={`my-8 relative border-2 p-6 flex items-center gap-6 transition-all ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-black bg-white'}`}>
      <div className={`w-14 h-14 flex items-center justify-center border-2 ${isPdf ? 'border-red-500/40 bg-red-500/5' : 'border-indigo-500/40 bg-indigo-500/5'}`}>
        <FileText className={`w-6 h-6 ${isPdf ? 'text-red-500' : 'text-indigo-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono font-bold opacity-40 uppercase tracking-widest">{isPdf ? 'Source_Document_Ref' : 'Source_Data_Node'}</p>
        <h4 className="text-base font-bold uppercase truncate">{name}</h4>
        <p className="text-[10px] font-mono opacity-40">{((media.size || 0) / (1024 * 1024)).toFixed(2)} MB</p>
      </div>
      <button 
        onClick={() => onDownloadAsset?.(media)}
        className={`p-3 border-2 transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'border-white/20 hover:bg-white hover:text-black' : 'border-black/20 hover:bg-black hover:text-white'}`}
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}

export function GenerationViewer({ content, title, theme, isAdmin, mediaFiles, onClose, onDownload, onCopy, onDownloadAsset, onSave, generationId }: GenerationViewerProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [activeMode, setActiveMode] = useState<'preview' | 'rich-text' | 'html'>('preview');
  
  // Fully Controlled State for Editor
  const [editorContent, setEditorContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize the editor with the provided content (sanitized HTML string)
  useEffect(() => {
    // Inject actual URLs replacing MEDIA_ID_ so ReactQuill parses them as valid images.
    // We add #MEDIA_ID_xxx to the end so we can identify them in renderPreview.
    let preProcessedContent = content;
    const mediaRegex = /MEDIA_ID_[a-zA-Z0-9_\-]+/g;
    
    preProcessedContent = preProcessedContent.replace(mediaRegex, (match) => {
      const id = match.replace('MEDIA_ID_', '').trim();
      const media = mediaFiles.find(m => m.id === id || m.firestoreId === id);
      if (media) {
        const displayUrl = media.previewUrl || media.storageUrl || media.uri;
        if (displayUrl) {
          return `${displayUrl}#${match}`;
        }
      }
      return match;
    });

    const parsed = marked.parse(preProcessedContent) as string;

    const initialHtml = DOMPurify.sanitize(parsed, {
      ADD_ATTR: ['src', 'alt', 'controls'],
      ADD_TAGS: ['img', 'video', 'audio', 'iframe']
    }).replace(/&nbsp;/g, ' ');

    setEditorContent(initialHtml);
  }, [content, mediaFiles]);

  const handleCopy = () => {
    onCopy();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    // 1. Sanitize the output HTML from Quill before sending
    const sanitizedHtml = DOMPurify.sanitize(editorContent);
    
    try {
      if (onSave) {
        await onSave(sanitizedHtml);
      } else {
        // Mock Firestore / DB save call
        console.log("MOCK: Saving to Firestore...");
        console.log("Document ID:", generationId || "NEW");
        console.log("Payload HTML Data:", sanitizedHtml);
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network latency
        
        // e.g.,
        // import { doc, updateDoc } from 'firebase/firestore';
        // import { db } from '../lib/firebase';
        // if (generationId) await updateDoc(doc(db, 'generations', generationId), { contentRaw: sanitizedHtml });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save content", error);
      alert("Failed to save. Check the console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreview = () => {
    return parse(editorContent, {
      replace: (domNode: any) => {
        // If it's a P tag that contains only an image (with our MEDIA ID), we replace the P tag itself to avoid <p><div> invalid HTML
        if (domNode.type === 'tag' && domNode.name === 'p' && domNode.children?.length === 1 && domNode.children[0].name === 'img') {
          const src = domNode.children[0].attribs?.src;
          if (src && src.includes('MEDIA_ID_')) {
            const replacement = handleMediaReplacement(domNode.children[0]);
            if (replacement) return replacement;
          }
        }

        // We replace img tags
        if (domNode.type === 'tag' && domNode.name === 'img') {
          return handleMediaReplacement(domNode);
        }
      }
    });
  };

  const handleMediaReplacement = (domNode: any) => {
    const src = domNode.attribs?.src;
    const alt = domNode.attribs?.alt;
    
    // Robust resolution: Check for MEDIA_ID in hash OR check if the URL itself matches a known storageUrl/previewUrl
    let media = null;
    let fallbackId = "";

    if (src) {
      const match = src.match(/MEDIA_ID_([a-zA-Z0-9_\-]+)/);
      if (match) {
        const id = match[1].trim();
        fallbackId = id;
        media = mediaFiles.find(m => m.id === id || m.firestoreId === id);
      }

      // If still not found by ID hash, try matching by the URL itself (in case Quill stripped the hash)
      if (!media) {
        // Clean URL by removing the hash if present for easier comparison
        const cleanSrc = src.split('#')[0];
        media = mediaFiles.find(m => 
          (m.storageUrl && cleanSrc.includes(m.storageUrl.split('?')[0])) || 
          (m.previewUrl && cleanSrc.includes(m.previewUrl.split('?')[0])) ||
          (m.uri && cleanSrc.includes(m.uri))
        );
      }
    }

    if (media) {
      return <MediaAsset theme={theme} media={media} alt={alt} onDownloadAsset={onDownloadAsset} />;
    }

    if (src && src.includes('MEDIA_ID_')) {
      return <div className="p-4 border border-dashed opacity-50 text-center font-mono text-[10px]">Reference_Lost: {fallbackId}</div>;
    }
    
    // Default fallback for non-media images
    return undefined; 
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex flex-col ${theme === 'dark' ? 'bg-[#0A0A0A] text-white' : 'bg-[#F8F8F7] text-black'} react-quill-custom-wrapper`}
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
          {activeMode === 'rich-text' && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] uppercase font-bold tracking-widest transition-all ${
                theme === 'dark' 
                  ? 'border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-semibold' 
                  : 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? "Saved!" : isSaving ? "Saving..." : "Save Edit"}
            </button>
          )}

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
                      mediaFiles.map((m, index) => (
                        <div key={`asset-list-${m.id || index}-${index}`} className={`flex items-center justify-between p-2 border border-transparent hover:border-current transition-colors group/asset ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                          <div className="flex flex-col min-w-0 flex-1 mr-2">
                             <span className="text-[10px] font-bold truncate uppercase">{m.name}</span>
                             <span className="text-[8px] opacity-40 font-mono">{((m.size || 0) / (1024 * 1024)).toFixed(2)}MB</span>
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

      <div className={`h-12 border-b flex items-center justify-center gap-8 ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-[#141414] bg-[#F8F8F7]'}`}>
        <button
          onClick={() => setActiveMode('preview')}
          className={`h-full px-4 text-[10px] font-mono font-bold tracking-widest uppercase transition-all flex items-center border-b-2 ${activeMode === 'preview' ? (theme === 'dark' ? 'border-white text-white' : 'border-black text-black') : 'border-transparent opacity-40 hover:opacity-100'}`}
        >
          <Columns className="w-3 h-3 mr-2" />
          Preview
        </button>
        <button
          onClick={() => setActiveMode('rich-text')}
          className={`h-full px-4 text-[10px] font-mono font-bold tracking-widest uppercase transition-all flex items-center border-b-2 ${activeMode === 'rich-text' ? (theme === 'dark' ? 'border-white text-white' : 'border-black text-black') : 'border-transparent opacity-40 hover:opacity-100'}`}
        >
          <Type className="w-3 h-3 mr-2" />
          Rich_Text
        </button>
        <button
          onClick={() => setActiveMode('html')}
          className={`h-full px-4 text-[10px] font-mono font-bold tracking-widest uppercase transition-all flex items-center border-b-2 ${activeMode === 'html' ? (theme === 'dark' ? 'border-white text-white' : 'border-black text-black') : 'border-transparent opacity-40 hover:opacity-100'}`}
        >
          <FileCode className="w-3 h-3 mr-2" />
          HTML
        </button>
      </div>

      <main className="flex-1 overflow-y-auto overflow-x-hidden history-scrollbar p-8 md:p-20 flex justify-center">
        <article className={`max-w-3xl w-full break-words ${activeMode === 'rich-text' ? 'max-w-5xl' : ''}`}>
          {activeMode === 'preview' && (
            <div className={`prose ${theme === 'dark' ? 'prose-invert' : 'prose-neutral'} w-full max-w-none [&_pre]:whitespace-pre-wrap [&_pre]:break-all [&_img]:max-w-full [&_*]:!break-words`}>
              {/* Fallback to markdown renderer but usually you want dangerouslySetInnerHTML parsing the saved HTML */}
              {renderPreview()}
            </div>
          )}
          {activeMode === 'rich-text' && (
            <div className={`min-h-[500px] border-2 overflow-x-hidden ${theme === 'dark' ? 'border-[#333] bg-[#111] text-white' : 'border-[#141414] bg-white text-black'}`}>
              <style>{`
                .quill-editor-custom .ql-editor {
                  font-size: 1.125rem;
                  line-height: 2 !important;
                  padding: 2rem;
                  overflow-wrap: break-word;
                  word-break: break-word;
                }
                .quill-editor-custom .ql-editor p {
                  margin-bottom: 1.5rem;
                }
                .quill-editor-custom .ql-editor h1, .quill-editor-custom .ql-editor h2, .quill-editor-custom .ql-editor h3 {
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                }
                .quill-editor-custom .ql-editor img {
                  margin: 2rem auto;
                  border-radius: 0.5rem;
                  max-width: 100%;
                }
              `}</style>
              <ReactQuill 
                theme="snow"
                value={editorContent}
                onChange={setEditorContent}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                className="quill-editor-custom min-h-[500px]"
              />
            </div>
          )}
          {activeMode === 'html' && (
            <div className={`p-6 min-h-[500px] border-2 font-mono text-xs whitespace-pre-wrap break-all overflow-x-hidden ${theme === 'dark' ? 'border-[#333] bg-[#111] text-indigo-300' : 'border-[#141414] bg-white text-indigo-700'}`}>
              {DOMPurify.sanitize(editorContent)}
            </div>
          )}
        </article>
      </main>

      <footer className={`h-12 border-t flex items-center justify-center ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A] text-white/30' : 'border-[#141414] bg-white text-black/30'}`}>
        <p className="text-[10px] uppercase font-mono tracking-[0.3em]">Velocity Synthesis Protocol // End of Transcript</p>
      </footer>
    </motion.div>
  );
}
