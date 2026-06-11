import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface AnswerFormProps {
  letter: string;
  roundNumber: number;
  timeRemaining: number;
  roundDuration: number;
  onSubmit: (answers: { name: string; place: string; animal: string; thing: string }) => void;
  hasSubmitted: boolean;
}

export const AnswerForm: React.FC<AnswerFormProps> = ({
  letter,
  roundNumber,
  timeRemaining,
  roundDuration,
  onSubmit,
  hasSubmitted,
}) => {
  const [answers, setAnswers] = useState({
    name: '',
    place: '',
    animal: '',
    thing: '',
  });

  const [displayLetter, setDisplayLetter] = useState(letter);
  const submittedRef = useRef(hasSubmitted);

  useEffect(() => {
    submittedRef.current = hasSubmitted;
  }, [hasSubmitted]);

  // Reset form on round change
  useEffect(() => {
    setAnswers({ name: '', place: '', animal: '', thing: '' });
  }, [roundNumber]);

  // Phase calculations
  const timeAboveRound = timeRemaining - roundDuration;
  const isSetupPhase = timeAboveRound > 0;
  const isRoundIntro = timeAboveRound > 2; // First 2 seconds of the 4s setup
  const isRevealing = timeAboveRound > 0 && timeAboveRound <= 2; // Last 2 seconds of the 4s setup

  // Handle letter cycling animation during reveal phase
  useEffect(() => {
    if (isRevealing) {
      const alphabet = 'ABCDEFGHIJKLMNOPRSTUVW';
      const interval = setInterval(() => {
        const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
        setDisplayLetter(randomChar);
      }, 60);
      return () => clearInterval(interval);
    } else {
      setDisplayLetter(letter);
    }
  }, [isRevealing, letter]);

  // Auto-submit whatever has been typed when the active timer reaches 1 second
  useEffect(() => {
    if (timeRemaining === 1 && !submittedRef.current) {
      onSubmit(answers);
    }
  }, [timeRemaining, onSubmit, answers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAnswers((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSubmitted && !isSetupPhase) {
      onSubmit(answers);
    }
  };

  // Circular timer details (clamped to roundDuration during reveal)
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const displayedTime = Math.min(timeRemaining, roundDuration);
  const strokeDashoffset = circumference - (displayedTime / roundDuration) * circumference;

  return (
    <>
      <AnimatePresence>
        {isRoundIntro && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-slate-950/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="text-center"
            >
              <h1 className="text-[clamp(60px,15vw,150px)] leading-none font-black text-white uppercase tracking-widest drop-shadow-[0_0_30px_rgba(16,217,160,0.6)]">
                Round {roundNumber}
              </h1>
              <p className="text-amber-400 font-bold text-xl md:text-3xl uppercase tracking-widest mt-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse">
                Get Ready!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-4 md:space-y-5 px-2 md:px-0">
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-slate-200 uppercase tracking-wide">Round {roundNumber}</h2>
          <p className="text-slate-400 text-[10px] md:text-xs font-semibold">
            {isSetupPhase ? 'Get ready to type...' : 'Fill all categories for the target letter'}
          </p>
        </div>

        {/* Circular Timer */}
        <div className="relative w-14 h-14 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-full">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="28"
              cy="28"
              r={radius}
              stroke="rgba(255,255,255,0.02)"
              strokeWidth="3.5"
              fill="transparent"
            />
            <motion.circle
              cx="28"
              cy="28"
              r={radius}
              stroke={displayedTime <= 5 ? '#EF4444' : '#6366f1'}
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </svg>
          <span className={`absolute font-black text-base ${displayedTime <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
            {displayedTime}
          </span>
        </div>
      </div>

      <div className="text-center py-5 bg-slate-950/60 rounded-2xl border border-slate-800/80 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
          {isSetupPhase ? 'SELECTING LETTER...' : 'ACTIVE LETTER'}
        </span>
        <motion.span
          key={displayLetter}
          initial={isSetupPhase ? { scale: 1.1, filter: 'blur(2px)' } : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
          className={`text-7xl font-black tracking-tight block ${
            isSetupPhase 
              ? 'text-indigo-500/40 animate-pulse scale-105' 
              : 'text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.25)]'
          }`}
        >
          {displayLetter}
        </motion.span>
      </div>

      <GlassCard className="border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['name', 'place', 'animal', 'thing'] as const).map((category) => {
              const val = answers[category];
              const isInvalidFirstLetter =
                val.trim().length > 0 && val.trim().charAt(0).toUpperCase() !== letter;

              return (
                <div key={category} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {category}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name={category}
                      value={val}
                      onChange={handleChange}
                      disabled={hasSubmitted || isSetupPhase}
                      placeholder={isSetupPhase ? 'Waiting for reveal...' : `Type a ${category}...`}
                      autoComplete="off"
                      autoFocus={category === 'name'}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-200 text-sm font-semibold bg-slate-950/60 transition-all ${
                        isInvalidFirstLetter
                          ? 'border-red-500/40 focus:border-red-500 focus:shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                          : 'border-white/5 focus:border-indigo-500 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    />
                    {isInvalidFirstLetter && !isSetupPhase && (
                      <span className="absolute right-3.5 top-2.5 text-[9px] bg-red-950/80 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase tracking-wider">
                        Must start with {letter}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <motion.button
            whileHover={(!hasSubmitted && !isSetupPhase) ? { scale: 1.01 } : {}}
            whileTap={(!hasSubmitted && !isSetupPhase) ? { scale: 0.99 } : {}}
            type="submit"
            disabled={hasSubmitted || isSetupPhase}
            className={`w-full py-4 md:py-3 mt-4 md:mt-2 rounded-xl font-bold flex items-center justify-center gap-2 border text-white transition-all text-sm md:text-xs uppercase tracking-widest h-14 md:h-11 shadow-[0_4px_12px_rgba(99,102,241,0.25)] ${
              hasSubmitted
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default shadow-none'
                : isSetupPhase
                ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30'
            }`}
          >
            {hasSubmitted ? (
              <>Submissions Locked</>
            ) : isSetupPhase ? (
              <>Selecting Target Letter...</>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Submit Answers
              </>
            )}
          </motion.button>
        </form>
      </GlassCard>
    </div>
    </>
  );
};
