import { motion, AnimatePresence } from "motion/react";
import { X, Download, Copy, Check, Type } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface GenerationViewerProps {
  content: string;
  title: string;
  theme: 'light' | 'dark';
  onClose: () => void;
  onDownload: () => void;
  onCopy: () => void;
}

export function GenerationViewer({ content, title, theme, onClose, onDownload, onCopy }: GenerationViewerProps) {
  const [isCopied, setIsCopied] = useState(false);

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
      className={`fixed inset-0 z-[100] flex flex-col ${theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-[#F8F8F7]'}`}
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
            className={`p-2 border-2 ${theme === 'dark' ? 'border-[#333] hover:bg-white hover:text-black' : 'border-[#141414] hover:bg-black hover:text-white'}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto history-scrollbar p-8 md:p-20 flex justify-center">
        <article className="max-w-3xl w-full">
          <div className={`prose ${theme === 'dark' ? 'prose-invert' : 'prose-neutral'} prose-headings:font-serif prose-headings:italic prose-p:font-sans prose-p:leading-relaxed selection:bg-yellow-200 selection:text-black`}>
            <Markdown remarkPlugins={[remarkGfm]}>
              {content}
            </Markdown>
          </div>
        </article>
      </main>

      <footer className={`h-12 border-t flex items-center justify-center ${theme === 'dark' ? 'border-[#333] bg-[#0A0A0A]' : 'border-[#141414] bg-white'}`}>
        <p className="text-[10px] uppercase font-mono tracking-[0.3em] opacity-30">Velocity Synthesis Protocol // End of Transcript</p>
      </footer>
    </motion.div>
  );
}
