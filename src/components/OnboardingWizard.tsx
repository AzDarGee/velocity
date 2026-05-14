import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Sparkles, Check } from 'lucide-react';

export interface Step {
  targetId: string;
  title: string;
  content: string;
  position: 'bottom' | 'top' | 'left' | 'right';
  appMode?: 'narrative' | 'media';
}

export function OnboardingWizard({ 
  onComplete,
  onStepChange,
  theme, 
  steps 
}: { 
  onComplete: () => void,
  onStepChange?: (step: number) => void,
  theme: 'light' | 'dark',
  steps: Step[] 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  useEffect(() => {
    const step = steps[currentStep];
    if (onStepChange) onStepChange(currentStep);

    let timeout: NodeJS.Timeout;
    let removeListener: () => void;

    const setup = () => {
      const element = document.getElementById(step.targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
        setTimeout(() => {
          setTargetRect(element.getBoundingClientRect());
        }, 500);
      }

      const updatePosition = () => {
        const element = document.getElementById(step.targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        }
      };
      
      window.addEventListener('resize', updatePosition);
      removeListener = () => window.removeEventListener('resize', updatePosition);
    };

    // Small delay for DOM updates (e.g. appMode change)
    timeout = setTimeout(setup, 150);

    return () => {
      clearTimeout(timeout);
      if (removeListener) removeListener();
    };
  }, [currentStep, steps, onStepChange]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  if (!targetRect) return null;

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Background Overlay with hole */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500" style={{
        clipPath: `polygon(
          0% 0%, 0% 100%, 
          ${targetRect.left}px 100%, 
          ${targetRect.left}px ${targetRect.top}px, 
          ${targetRect.right}px ${targetRect.top}px, 
          ${targetRect.right}px ${targetRect.bottom}px, 
          ${targetRect.left}px ${targetRect.bottom}px, 
          ${targetRect.left}px 100%, 
          100% 100%, 100% 0%
        )`
      }} />

      {/* Content Tooltip */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`absolute pointer-events-auto p-6 w-[320px] shadow-2xl border-2 transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#141414] border-white/20 text-[#F8F8F7]' : 'bg-white border-black text-[#141414]'
        }`}
        style={{
          top: currentStepData.position === 'bottom' ? targetRect.bottom + 20 : 
               currentStepData.position === 'top' ? targetRect.top - 200 :
               targetRect.top + (targetRect.height / 2) - 100,
          left: currentStepData.position === 'right' ? targetRect.right + 20 :
                currentStepData.position === 'left' ? targetRect.left - 340 :
                targetRect.left + (targetRect.width / 2) - 160,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">Step {currentStep + 1} / {steps.length}</span>
          </div>
          <button onClick={onComplete} className="p-1 hover:opacity-50 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="font-serif italic text-xl mb-3">{currentStepData.title}</h3>
        <p className="text-xs leading-relaxed opacity-80 mb-6 font-mono tracking-tight uppercase">
          {currentStepData.content}
        </p>

        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={onComplete}
            className="text-[10px] uppercase font-mono tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            Skip Intro
          </button>
          
          <button
            onClick={next}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-2 transition-all ${
              theme === 'dark' 
                ? 'bg-white text-black border-white hover:bg-black hover:text-white' 
                : 'bg-black text-white border-black hover:bg-white hover:text-black'
            }`}
          >
            {currentStep === steps.length - 1 ? (
              <>
                Initialize protocol
                <Check className="w-3 h-3" />
              </>
            ) : (
              <>
                Next step
                <ChevronRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

        {/* Pointer Arrow */}
        <div className={`absolute w-4 h-4 border-t-2 border-l-2 rotate-45 ${
          theme === 'dark' ? 'bg-[#141414] border-white/20' : 'bg-white border-black'
        }`} style={{
          top: currentStepData.position === 'bottom' ? '-9px' : 
               currentStepData.position === 'top' ? 'auto' : '50%',
          bottom: currentStepData.position === 'top' ? '-9px' : 'auto',
          left: currentStepData.position === 'right' ? '-9px' : 
                currentStepData.position === 'left' ? 'auto' : '50%',
          right: currentStepData.position === 'left' ? '-9px' : 'auto',
          marginTop: (currentStepData.position === 'left' || currentStepData.position === 'right') ? '-8px' : '0px',
          marginLeft: (currentStepData.position === 'top' || currentStepData.position === 'bottom') ? '-8px' : '0px',
        }} />
      </motion.div>
    </div>
  );
}
