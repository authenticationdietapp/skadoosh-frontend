import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const stars = Array.from({ length: 72 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 61) % 100}%`,
  size: `${index % 3 === 0 ? 3 : 2}px`,
  delay: `${-((index % 14) / 5)}s`,
}));

export function ComingSoon() {
  return (
    <main className="app-shell launch-gate-shell">
      <section className="launch-gate-card" aria-labelledby="coming-soon-title">
        <p className="quest-label">LEARNING QUEST</p>
        <h1 id="coming-soon-title">Coming Soon</h1>
        <p>Bablu Learning is getting ready to launch. Please check back soon.</p>
      </section>
    </main>
  );
}

function LaunchGate({ onLaunchComplete }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [launchError, setLaunchError] = useState('');
  const launchRequestRef = useRef(false);
  const isLiftingOff = phase === 'liftoff' || phase === 'warp-wait';

  useEffect(() => {
    if (phase !== 'countdown') {
      return undefined;
    }

    if (countdown === 0) {
      setPhase('liftoff');
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCountdown((currentCountdown) => currentCountdown - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== 'warp-wait') {
      return undefined;
    }

    if (launchRequestRef.current) {
      return undefined;
    }

    launchRequestRef.current = true;
    let isMounted = true;

    const setWebsiteLive = async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .update({ is_launched: true })
        .eq('id', 1)
        .select('is_launched')
        .single();
      if (error) {
        throw error;
      }
      if (data?.is_launched !== true) {
        throw new Error('Supabase did not confirm that the website is live.');
      }

      if (isMounted) {
        onLaunchComplete?.();
        navigate('/dashboard');
      }
    };

    setWebsiteLive().catch((error) => {
      console.error('Failed to launch the website:', error);
      launchRequestRef.current = false;
      if (isMounted) {
        setLaunchError(`Could not launch the website: ${error.message}`);
        setCountdown(3);
        setPhase('idle');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, onLaunchComplete, phase]);

  return (
    <main
      className="fixed inset-0 z-50 overflow-hidden bg-black text-white"
      aria-label="Website launch sequence"
    >
      <motion.div
        className={`launch-space ${isLiftingOff ? 'launch-scene--warp' : ''}`}
        aria-hidden="true"
        animate={isLiftingOff
          ? {
            scale: 2.2,
            y: '22vh',
            x: phase === 'liftoff' ? [0, -10, 10, -10, 0] : 0,
          }
          : { scale: 1, y: 0, x: 0 }}
        transition={{
          duration: 2.5,
          ease: [0.2, 0.65, 0.3, 1],
          x: {
            duration: 0.18,
            repeat: phase === 'liftoff' ? 8 : 0,
            ease: 'linear',
          },
        }}
      >
        {stars.map((star, index) => (
          <span
            className="launch-star"
            key={index}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2"
        animate={isLiftingOff ? { y: '-150vh' } : { y: 0 }}
        transition={phase === 'liftoff'
          ? { duration: 2, ease: [0.55, 0.05, 0.8, 0.35] }
          : { duration: 0.3 }}
        onAnimationComplete={() => {
          if (phase === 'liftoff') {
            setPhase('warp-wait');
          }
        }}
        aria-hidden="true"
      >
        <div
          className={`launch-rocket-art ${isLiftingOff ? 'launch-rocket-art--ignited' : ''}`}
        >
          <span className="launch-rocket-body" />
          <span className="launch-rocket-window" />
          <span className="launch-flame" />
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {phase === 'countdown' && (
          <motion.div
            key={countdown}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{
              opacity: [0, 1, 1],
              scale: [0.45, 1.15, 1],
              textShadow: [
                '0 0 0 rgba(92, 207, 255, 0)',
                '0 0 46px rgba(92, 207, 255, 0.95)',
                '0 0 24px rgba(92, 207, 255, 0.7)',
              ],
            }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.88, ease: 'easeOut' }}
            aria-live="assertive"
            aria-label={`Countdown ${countdown}`}
          >
            <span className="text-[clamp(8rem,30vw,20rem)] font-black leading-none text-cyan-100">
              {countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        className="relative z-10 box-border flex min-h-full flex-col items-center justify-between px-6 py-12 text-center sm:py-16"
        animate={isLiftingOff ? { opacity: 0, y: -24 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.5em] text-cyan-300">
            Bablu Learning · Mission Control
          </p>
          <h1 className="text-3xl font-black uppercase tracking-[0.12em] sm:text-5xl">
            Ready for liftoff?
          </h1>
        </div>

        <button
          className="launch-sequence-button rounded-full border border-cyan-200/50 bg-cyan-300/10 px-8 py-4 text-sm font-extrabold uppercase tracking-[0.16em] text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,0.28)] backdrop-blur-md transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 disabled:cursor-wait disabled:opacity-70 sm:px-12 sm:py-5 sm:text-base"
          type="button"
          disabled={phase !== 'idle'}
          onClick={() => {
            launchRequestRef.current = false;
            setLaunchError('');
            setCountdown(3);
            setPhase('countdown');
          }}
        >
          {phase === 'idle' ? 'Initiate Launch' : 'Launch sequence engaged'}
        </button>
        {launchError && (
          <p className="launch-error" role="alert">{launchError}</p>
        )}
      </motion.section>
    </main>
  );
}

export default LaunchGate;
