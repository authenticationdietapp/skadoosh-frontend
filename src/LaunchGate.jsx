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

const screenShake = [0, -16, 15, -20, 18, -12, 10, -6, 3, 0];
const flameCounterShake = screenShake.map((offset) => -offset);

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
  const [countdown, setCountdown] = useState(10);
  const [launchError, setLaunchError] = useState('');
  const [flameFlicker, setFlameFlicker] = useState({ scaleY: 0.9, opacity: 0.95 });
  const launchRequestRef = useRef(false);
  const isIgniting = phase === 'ignition';
  const isLiftingOff = phase === 'liftoff' || phase === 'warp-wait';
  const isFlameVisible = isIgniting || phase === 'liftoff';

  useEffect(() => {
    if (phase !== 'countdown') {
      return undefined;
    }

    if (countdown === 0) {
      setPhase('ignition');
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCountdown((currentCountdown) => currentCountdown - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== 'ignition') {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setPhase('liftoff');
    }, 850);

    return () => window.clearTimeout(timerId);
  }, [phase]);

  useEffect(() => {
    if (!isFlameVisible) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setFlameFlicker({
        scaleY: 0.75 + Math.random() * 0.7,
        opacity: 0.72 + Math.random() * 0.28,
      });
    }, 80);

    return () => window.clearInterval(timerId);
  }, [isFlameVisible]);

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
        setCountdown(10);
        setPhase('idle');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, onLaunchComplete, phase]);

  return (
    <motion.main
      className="fixed inset-0 z-50 overflow-hidden bg-black text-white"
      animate={{ x: isIgniting ? screenShake : 0 }}
      transition={{
        x: {
          duration: 0.45,
          ease: 'linear',
          repeat: isIgniting ? Infinity : 0,
        },
      }}
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

      <motion.header
        className="absolute inset-x-0 top-8 z-30 px-4 text-center"
        animate={isLiftingOff ? { opacity: 0, y: -18 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-2xl font-black uppercase tracking-widest text-cyan-100 drop-shadow-[0_0_18px_rgba(103,232,249,0.85)] md:text-3xl">
          SKADOOSH AI LEARNING
        </p>
      </motion.header>

      <div
        className="absolute left-1/2 top-[75%] z-10 w-72 -translate-x-1/2"
        aria-hidden="true"
      >
        <div className="mx-auto h-4 w-24 rounded-t-md border border-slate-400/70 bg-gradient-to-b from-slate-300 to-slate-500 shadow-[0_0_24px_rgba(148,163,184,0.35)]" />
        <div className="relative mx-auto h-8 w-56 border-x-4 border-slate-500 bg-gradient-to-b from-slate-700 to-slate-900">
          <div className="absolute inset-x-3 top-2 h-1 rounded bg-orange-300/80 shadow-[0_0_12px_rgba(251,146,60,0.8)]" />
        </div>
        <div className="mx-auto h-5 w-72 border border-slate-400/70 bg-gradient-to-b from-slate-400 to-slate-700 [clip-path:polygon(10%_0,90%_0,100%_100%,0_100%)]" />
        <div className="mx-auto h-2 w-80 rounded-full bg-slate-500/80 shadow-[0_8px_24px_rgba(148,163,184,0.35)]" />
      </div>

      <motion.div
        className="absolute left-1/2 top-[68%] z-20"
        style={{ marginLeft: -70, marginTop: -95 }}
        animate={{ x: 0, y: isLiftingOff ? '-150vh' : 0 }}
        transition={{
          x: { duration: 0 },
          y: isLiftingOff
            ? { duration: 2, ease: [0.55, 0.05, 0.8, 0.35] }
            : { duration: 0.3 },
        }}
        onAnimationComplete={() => {
          if (phase === 'liftoff') {
            setPhase('warp-wait');
          }
        }}
        aria-hidden="true"
      >
        <div className="launch-rocket-art">
          <span className="launch-rocket-body" />
          <span className="launch-rocket-window" />
        </div>
      </motion.div>

      {isFlameVisible && (
        <motion.div
          className="absolute left-1/2 top-[calc(68%_+_55px)] z-20 h-36 w-16"
          style={{ marginLeft: -32, transformOrigin: 'top center' }}
          animate={{
            x: isIgniting ? flameCounterShake : 0,
            y: isLiftingOff ? '-150vh' : 0,
            scaleY: flameFlicker.scaleY,
            opacity: flameFlicker.opacity,
          }}
          transition={{
            x: {
              duration: 0.45,
              ease: 'linear',
              repeat: isIgniting ? Infinity : 0,
            },
            y: isLiftingOff
              ? { duration: 2, ease: [0.55, 0.05, 0.8, 0.35] }
              : { duration: 0.3 },
            scaleY: { duration: 0.08, ease: 'easeOut' },
            opacity: { duration: 0.08, ease: 'easeOut' },
          }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 rounded-[50%_50%_45%_45%] bg-gradient-to-b from-yellow-100 via-orange-400 to-red-600 blur-[2px] shadow-[0_0_40px_rgba(255,117,24,0.95)]" />
          <div className="absolute left-1/2 top-1 h-24 w-8 -translate-x-1/2 rounded-[50%_50%_45%_45%] bg-gradient-to-b from-white via-yellow-200 to-orange-400 blur-sm" />
        </motion.div>
      )}

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
        className="absolute inset-x-0 bottom-8 z-30 flex flex-col items-center px-6 text-center sm:bottom-12"
        animate={isLiftingOff ? { opacity: 0, y: -24 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <button
          className="launch-sequence-button rounded-full border border-cyan-200/50 bg-cyan-300/10 px-8 py-4 text-sm font-extrabold uppercase tracking-[0.16em] text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,0.28)] backdrop-blur-md transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 disabled:cursor-wait disabled:opacity-70 sm:px-12 sm:py-5 sm:text-base"
          type="button"
          disabled={phase !== 'idle'}
          onClick={() => {
            launchRequestRef.current = false;
            setLaunchError('');
            setCountdown(10);
            setPhase('countdown');
          }}
        >
          {phase === 'idle' ? 'INITIATE LAUNCH' : 'LAUNCH SEQUENCE ENGAGED'}
        </button>
        {launchError && (
          <p className="launch-error" role="alert">{launchError}</p>
        )}
      </motion.section>
    </motion.main>
  );
}

export default LaunchGate;
