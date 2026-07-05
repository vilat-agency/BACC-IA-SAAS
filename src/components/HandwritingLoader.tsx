import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { PenTool, Sparkles } from 'lucide-react';

const ACADEMIC_PHRASES = [
  "Soit f la fonction définie sur R par f(x) = x² - 1 - 2 ln(x)",
  "Calculons la limite de f(x) lorsque x tend vers 1...",
  "D'après le théorème des valeurs intermédiaires...",
  "La dérivée f'(x) est donnée par l'expression...",
  "dressons le tableau de variations de la fonction f...",
  "Déterminons l'équation de la tangente (T) au point d'inflexion...",
  "Calculons l'intégrale I(λ) par intégration par parties...",
  "Montrons que la suite Sn est convergente et calculons sa limite..."
];

interface HandwritingLoaderProps {
  timeElapsed: number;
}

export function HandwritingLoader({ timeElapsed }: HandwritingLoaderProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);

  useEffect(() => {
    // Cycle through academic phrases to simulate progressive writing
    const lineInterval = setInterval(() => {
      setCurrentLineIndex((prev) => {
        const next = (prev + 1) % ACADEMIC_PHRASES.length;
        return next;
      });
    }, 4500);

    return () => clearInterval(lineInterval);
  }, []);

  // Update visible lines based on current index to show 3 lines maximum with typewriter feel
  useEffect(() => {
    const lines = [
      ACADEMIC_PHRASES[(currentLineIndex) % ACADEMIC_PHRASES.length],
      ACADEMIC_PHRASES[(currentLineIndex + 1) % ACADEMIC_PHRASES.length],
      ACADEMIC_PHRASES[(currentLineIndex + 2) % ACADEMIC_PHRASES.length],
    ];
    setVisibleLines(lines);
  }, [currentLineIndex]);

  return (
    <div className="w-full py-10 px-4 select-none relative" id="handwriting-loader">
      {/* Floating status badge */}
      <div className="flex items-center gap-2 justify-center mb-8">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold shadow-sm animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          <span>L'élève rédige sa copie baccalauréat...</span>
        </div>
        <div className="text-xs text-gray-400 font-sans">
          Temps écoulé : <span className="font-mono font-semibold text-gray-600">{timeElapsed}s</span>
        </div>
      </div>

      {/* Simulated lines paper writing area */}
      <div className="relative max-w-xl mx-auto rounded-xl bg-amber-50/15 border border-amber-100/40 p-6 shadow-inner overflow-hidden min-h-[180px]">
        
        {/* Dynamic pencil tracker */}
        <motion.div
          className="absolute z-10 pointer-events-none text-blue-600"
          animate={{
            x: ["5%", "85%", "5%", "85%", "5%"],
            y: [24, 60, 96, 60, 24],
            rotate: [20, 35, 18, 32, 20],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ originX: 0, originY: 1 }}
        >
          <div className="relative">
            <PenTool className="w-8 h-8 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)] filter brightness-110" />
            <motion.span 
              className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </motion.div>

        {/* Ink-colored handwritten text lines */}
        <div className="space-y-3 font-handwriting text-blue-800 text-lg md:text-xl leading-[36px] pl-10">
          {visibleLines.map((line, idx) => (
            <div key={idx} className="relative h-[36px] flex items-center border-b border-blue-100/50">
              {/* Typewriter text reveal */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{
                  width: { duration: 4, ease: "linear" },
                  opacity: { duration: 0.3 }
                }}
                className="overflow-hidden whitespace-nowrap text-blue-800 italic"
              >
                {line}
              </motion.div>
              
              {/* Subtle writing scratch overlay */}
              <motion.div 
                className="absolute right-0 top-0 h-full w-12 bg-gradient-to-r from-transparent to-amber-50/10 pointer-events-none"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Encouragement message */}
      <div className="text-center mt-6 text-xs text-gray-500 font-sans italic">
        "La clarté vient de la succession logique des équations..."
      </div>
    </div>
  );
}
