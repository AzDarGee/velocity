import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface RotatingQuotesProps {
  quotes: string[];
  interval?: number;
  theme?: 'light' | 'dark';
}

export const RotatingQuotes = React.memo(({ quotes, interval = 2500, theme = 'dark' }: RotatingQuotesProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % quotes.length);
    }, interval);
    return () => clearInterval(timer);
  }, [quotes.length, interval]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="relative h-12 w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className={`text-[10px] uppercase font-mono font-bold tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-black'}`}
          >
            {quotes[index]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5">
        {quotes.map((_, i) => (
          <div 
            key={i} 
            className={`h-[2px] transition-all duration-500 ${
              i === index 
                ? `w-4 ${theme === 'dark' ? 'bg-white' : 'bg-black'}` 
                : `w-1 ${theme === 'dark' ? 'bg-white/20' : 'bg-black/20'}`
            }`}
          />
        ))}
      </div>
    </div>
  );
});
