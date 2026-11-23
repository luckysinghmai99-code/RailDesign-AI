import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export function TrainSvg({
  className = '',
  accent = '#2563EB',
  headlight = '#F59E0B',
  elevated = false,
}: {
  className?: string;
  accent?: string;
  headlight?: string;
  elevated?: boolean;
}) {
  const hullOpacity = elevated ? 0.88 : 0.28;
  const strokeOpacity = elevated ? 0.72 : 0.4;

  return (
    <svg viewBox="0 0 360 58" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="rd-headlight-beam" x1="330" y1="36" x2="360" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={headlight} stopOpacity="0.65" />
          <stop offset="100%" stopColor={headlight} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Headlight Beam Cone */}
      <polygon points="334,29 360,20 360,48 334,39" fill="url(#rd-headlight-beam)" />

      {/* Rear Coach */}
      <rect
        x="4"
        y="16"
        width="96"
        height="27"
        rx="5"
        fill="#0F172A"
        fillOpacity={hullOpacity}
        stroke={accent}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.5"
      />
      <rect x="13" y="22" width="18" height="9" rx="2" fill={accent} fillOpacity="0.85" />
      <rect x="37" y="22" width="18" height="9" rx="2" fill={accent} fillOpacity="0.85" />
      <rect x="61" y="22" width="18" height="9" rx="2" fill={accent} fillOpacity="0.85" />
      <rect x="85" y="22" width="9" height="9" rx="1.5" fill="#E2E8F0" fillOpacity="0.8" />
      <rect x="10" y="36" width="84" height="2" rx="1" fill={accent} fillOpacity="0.7" />
      <circle cx="22" cy="46" r="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.2" />
      <circle cx="80" cy="46" r="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.2" />

      {/* Coupler 1 */}
      <rect x="100" y="28" width="8" height="5" rx="1" fill="#64748B" />

      {/* Middle Express Coach */}
      <rect
        x="108"
        y="15"
        width="104"
        height="28"
        rx="5"
        fill="#0F172A"
        fillOpacity={hullOpacity}
        stroke={accent}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.5"
      />
      <rect x="118" y="21" width="20" height="9" rx="2" fill="#38BDF8" fillOpacity="0.88" />
      <rect x="144" y="21" width="20" height="9" rx="2" fill="#38BDF8" fillOpacity="0.88" />
      <rect x="170" y="21" width="20" height="9" rx="2" fill="#38BDF8" fillOpacity="0.88" />
      <rect x="196" y="21" width="10" height="9" rx="1.5" fill="#E2E8F0" fillOpacity="0.85" />
      <rect x="114" y="36" width="92" height="2.2" rx="1" fill={accent} fillOpacity="0.85" />
      <circle cx="128" cy="46" r="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.2" />
      <circle cx="192" cy="46" r="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.2" />

      {/* Coupler 2 */}
      <rect x="212" y="28" width="8" height="5" rx="1" fill="#64748B" />

      {/* Streamlined High-Speed Locomotive */}
      <path
        d="M220 13H286C310 13 330 24 337 38C338 41 336 43 331 43H220V13Z"
        fill={accent}
        fillOpacity={elevated ? 0.94 : 0.88}
        stroke="#E2E8F0"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      {/* Pantograph */}
      <path d="M244 13L252 6H266L272 13" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Cab Windshield */}
      <path d="M284 18L320 31H284V18Z" fill="#F8FAFC" fillOpacity="0.94" />
      {/* Locomotive Windows */}
      <rect x="230" y="20" width="20" height="9" rx="2" fill="#F8FAFC" fillOpacity="0.9" />
      <rect x="256" y="20" width="20" height="9" rx="2" fill="#F8FAFC" fillOpacity="0.9" />
      {/* Gold Accent Stripe + Headlight */}
      <rect x="223" y="35" width="106" height="3" rx="1.5" fill={headlight} />
      <circle cx="333" cy="36" r="4.2" fill={headlight} />
      {/* Bogie Wheels */}
      <circle cx="240" cy="46" r="4.4" fill="#0F172A" stroke="#E2E8F0" strokeWidth="1.4" />
      <circle cx="264" cy="46" r="4.4" fill="#0F172A" stroke="#E2E8F0" strokeWidth="1.4" />
      <circle cx="304" cy="46" r="4.4" fill="#0F172A" stroke="#E2E8F0" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Global ambient animated rail network.
 * When `elevated` is true (logged-in internal dashboard & workspace), renders at z-30
 * so the enlarged locomotive and coaches travel visibly ABOVE project cards, engine cards,
 * service cards, and settings panels while remaining strictly pointer-events-none.
 */
export function GlobalTrainBackdrop({
  compact = false,
  elevated = false,
}: {
  compact?: boolean;
  elevated?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (elevated) {
    return (
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden select-none z-30"
        aria-hidden="true"
      >
        {/* Track 1: Upper Corridor (LTR) passing above top workspace / project cards */}
        <div className="absolute top-[16%] left-0 right-0 h-20 opacity-90">
          <svg className="w-full h-full text-blue-500/30 dark:text-blue-400/25" preserveAspectRatio="none">
            <line x1="0" y1="54" x2="100%" y2="54" stroke="currentColor" strokeWidth="1.2" />
            <line
              x1="0"
              y1="59"
              x2="100%"
              y2="59"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="8 16"
              className={prefersReducedMotion ? '' : 'animate-rail-track'}
            />
          </svg>
          {!prefersReducedMotion && (
            <div className="absolute top-0 left-0 animate-rail-ltr drop-shadow-[0_6px_14px_rgba(37,99,235,0.28)]">
              <TrainSvg className="w-[300px] sm:w-[390px] h-[52px] sm:h-[64px]" accent="#2563EB" headlight="#F59E0B" elevated />
            </div>
          )}
        </div>

        {/* Track 2: Mid-Screen Bidirectional Curved Express passing directly over engine, service & settings cards */}
        <div className="absolute top-[46%] left-0 right-0 h-28 opacity-95">
          <svg viewBox="0 0 1440 112" fill="none" className="w-full h-full text-sky-500/25 dark:text-sky-400/25" preserveAspectRatio="none">
            <path d="M0 72 Q 360 28 720 68 T 1440 52" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M0 79 Q 360 35 720 75 T 1440 59"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="7 14"
              className={prefersReducedMotion ? '' : 'animate-rail-track'}
            />
          </svg>
          {!prefersReducedMotion && (
            <div className="absolute top-2 left-0 animate-rail-bidir drop-shadow-[0_8px_18px_rgba(14,165,233,0.3)]">
              <TrainSvg className="w-[320px] sm:w-[420px] h-[56px] sm:h-[68px]" accent="#0284C7" headlight="#FBBF24" elevated />
            </div>
          )}
        </div>

        {/* Track 3: Lower Express Return (RTL) passing above lower gallery, engine cards & workspace panels */}
        {!compact && (
          <div className="absolute top-[76%] left-0 right-0 h-20 opacity-90">
            <svg className="w-full h-full text-indigo-500/25 dark:text-indigo-400/25" preserveAspectRatio="none">
              <line x1="0" y1="54" x2="100%" y2="54" stroke="currentColor" strokeWidth="1.2" />
              <line
                x1="0"
                y1="59"
                x2="100%"
                y2="59"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="9 15"
                className={prefersReducedMotion ? '' : 'animate-rail-track'}
              />
            </svg>
            {!prefersReducedMotion && (
              <div className="absolute top-0 left-0 animate-rail-rtl drop-shadow-[0_6px_14px_rgba(37,99,235,0.28)]">
                <div style={{ transform: 'scaleX(-1)' }}>
                  <TrainSvg className="w-[290px] sm:w-[370px] h-[50px] sm:h-[62px]" accent="#1D4ED8" headlight="#F59E0B" elevated />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* Top Express Horizontal Track */}
      <div className="absolute top-16 left-0 right-0 h-14 opacity-35 dark:opacity-40">
        <svg className="w-full h-full text-slate-400 dark:text-slate-600" preserveAspectRatio="none">
          <line x1="0" y1="38" x2="100%" y2="38" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" />
          <line
            x1="0"
            y1="42"
            x2="100%"
            y2="42"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="6 14"
            className={prefersReducedMotion ? '' : 'animate-rail-track'}
            strokeOpacity="0.25"
          />
        </svg>
        {!prefersReducedMotion && (
          <div className="absolute top-0 left-0 animate-rail-ltr text-slate-600 dark:text-slate-300">
            <TrainSvg className="w-52 h-10" />
          </div>
        )}
      </div>

      {/* Curved Viaduct Arc */}
      {!compact && (
        <div className="absolute top-[42%] left-0 right-0 h-24 opacity-25 dark:opacity-30">
          <svg viewBox="0 0 1440 96" fill="none" className="w-full h-full text-slate-400 dark:text-slate-700" preserveAspectRatio="none">
            <path d="M0 72 Q 480 12 960 58 T 1440 34" stroke="currentColor" strokeWidth="1.25" />
            <path d="M0 78 Q 480 18 960 64 T 1440 40" stroke="currentColor" strokeWidth="1" strokeDasharray="5 12" />
          </svg>
          {!prefersReducedMotion && (
            <div className="absolute top-2 left-0 animate-rail-curve text-slate-500 dark:text-slate-400">
              <TrainSvg className="w-44 h-8" accent="#0EA5E9" />
            </div>
          )}
        </div>
      )}

      {/* Lower Return Corridor Track */}
      <div className="absolute bottom-8 left-0 right-0 h-14 opacity-30 dark:opacity-35">
        <svg className="w-full h-full text-slate-400 dark:text-slate-700" preserveAspectRatio="none">
          <line x1="0" y1="36" x2="100%" y2="36" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
          <line
            x1="0"
            y1="40"
            x2="100%"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="8 16"
            strokeOpacity="0.25"
          />
        </svg>
        {!prefersReducedMotion && (
          <div className="absolute top-0 left-0 animate-rail-rtl text-slate-600 dark:text-slate-400">
            <div style={{ transform: 'scaleX(-1)' }}>
              <TrainSvg className="w-44 h-8" accent="#3B82F6" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Signature 4-loop prompt ceremony wrapper:
 * When `isLooping` turns true on clicking Generate:
 * 1. Brings a prominent train above the prompt box
 * 2. Executes exactly 4 visual loops around the prompt box perimeter
 * 3. Sends the train forward toward its destination track
 * 4. Calls `onCeremonyComplete` & shows generation journey progress
 */
export function PromptTrainWrapper({
  children,
  isLooping,
  isGenerating,
  journeyStage,
  onCeremonyComplete,
}: {
  children: React.ReactNode;
  isLooping: boolean;
  isGenerating: boolean;
  journeyStage?: string;
  onCeremonyComplete?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [loopNumber, setLoopNumber] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'looping' | 'departing' | 'journey'>('idle');

  useEffect(() => {
    if (!isLooping) {
      if (!isGenerating) {
        setPhase('idle');
        setLoopNumber(0);
      }
      return;
    }

    if (prefersReducedMotion) {
      setPhase('journey');
      onCeremonyComplete?.();
      return;
    }

    setPhase('looping');
    setLoopNumber(1);

    const t1 = window.setTimeout(() => setLoopNumber(2), 520);
    const t2 = window.setTimeout(() => setLoopNumber(3), 1040);
    const t3 = window.setTimeout(() => setLoopNumber(4), 1560);
    const t4 = window.setTimeout(() => {
      setPhase('departing');
    }, 2080);
    const t5 = window.setTimeout(() => {
      setPhase('journey');
      onCeremonyComplete?.();
    }, 2550);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [isLooping, isGenerating, prefersReducedMotion, onCeremonyComplete]);

  return (
    <div className="relative">
      {/* Prominent Above-Prompt Track & 4-Loop Train */}
      {(phase === 'looping' || phase === 'departing') && (
        <div className="mb-2 flex items-center justify-between px-3 py-2 rounded-lg bg-blue-950/10 dark:bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <motion.div
              key={phase === 'departing' ? 'depart' : `loop-${loopNumber}`}
              initial={phase === 'departing' ? { x: 0, opacity: 1 } : { x: -40, opacity: 0.85 }}
              animate={
                phase === 'departing'
                  ? { x: 420, opacity: 0 }
                  : { x: [0, 180, 0], opacity: 1 }
              }
              transition={{ duration: phase === 'departing' ? 0.45 : 0.5, ease: 'easeInOut' }}
              className="text-slate-900 dark:text-white shrink-0"
            >
              <TrainSvg className="w-36 h-8" accent="#2563EB" headlight="#F59E0B" elevated />
            </motion.div>
          </div>
          <span className="text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
            {phase === 'departing' ? 'Express dispatched' : `Loop ${loopNumber} / 4`}
          </span>
        </div>
      )}

      {/* Perimeter Track Ring during the 4 loops */}
      <div className="relative rounded-xl">
        {phase === 'looping' && (
          <motion.div
            key={`ring-${loopNumber}`}
            initial={{ opacity: 0.3, scale: 0.995 }}
            animate={{ opacity: [0.4, 1, 0.4], scale: 1 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-blue-500/70"
            aria-hidden="true"
          />
        )}
        {children}
      </div>

      {/* Generation Journey Progress Bar */}
      {(isGenerating || phase === 'journey') && (
        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 py-2.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {journeyStage || 'Generating project architecture across rail engines...'}
            </span>
            <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
              In transit
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <motion.div
              className="h-full bg-blue-600 rounded-full"
              initial={{ x: '-60%', width: '45%' }}
              animate={prefersReducedMotion ? { x: '0%', width: '100%' } : { x: ['-45%', '120%'] }}
              transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
