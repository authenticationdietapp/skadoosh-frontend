import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import './App.css';
import { supabase } from './supabaseClient';
import Admin from './Admin';
import Blackboard from './Blackboard';
import Dashboard from './Dashboard';
import Avatar3D from './components/Avatar3D.jsx';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Refund from './pages/Refund';
import { LegalFooter } from './pages/LegalPage';
import LaunchGate from './LaunchGate';
import { motion } from 'framer-motion';
import LandingPage from './pages/LandingPage';

const ADMIN_EMAIL = 'authenticationdietapp@gmail.com';

const getCourseIdFromPath = (pathname = window.location.pathname) => {
  const match = pathname.match(/^\/learn\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const getLegalPageFromPath = () => {
  const legalPages = {
    '/privacy': Privacy,
    '/terms': Terms,
    '/refund': Refund,
  };
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return legalPages[pathname] || null;
};

function LearningApp({ onLaunchStatusChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState(
    () => (getCourseIdFromPath() ? 'blackboard' : 'dashboard'),
  );
  const [activeCourse, setActiveCourse] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [username, setUsername] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authFeedback, setAuthFeedback] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [quota, setQuota] = useState(8);
  const recognitionRef = useRef(null);
  const isMountedRef = useRef(false);
  const profileSyncsRef = useRef(new Map());
  const speechRequestRef = useRef(0);
  const voicesChangedHandlerRef = useRef(null);
  const speechRecognitionSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const LegalPageRoute = getLegalPageFromPath();

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    const syncRoute = async () => {
      if (!session || isLoadingSession) {
        setCurrentView('dashboard');
        setActiveCourse(null);
        return;
      }

      const courseId = getCourseIdFromPath(location.pathname);
      if (!courseId) {
        setCurrentView('dashboard');
        setActiveCourse(null);
        return;
      }

      setCurrentView('blackboard');
      const { data: course, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to load course from learning route:', error);
        setAuthFeedback({
          type: 'error',
          text: `Could not load this course: ${error.message}`,
        });
        navigate('/login', { replace: true });
        setCurrentView('dashboard');
        setActiveCourse(null);
        return;
      }

      setActiveCourse(course);
      setChatHistory([{
        role: 'system',
        content: `The learner is studying the course "${course.title}". Use this syllabus to keep your tutoring relevant to the course:\n${course.syllabus_text || ''}`,
      }]);
      setMessages([]);
      setMessage('');
    };

    syncRoute();
    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate, session, isLoadingSession]);

  useEffect(() => {
    let isMounted = true;
    isMountedRef.current = true;
    const profileSyncs = profileSyncsRef.current;
    const ensureProfile = (activeSession) => {
      if (!activeSession) {
        setUserProfile(null);
        setIsLoadingProfile(false);
        return Promise.resolve();
      }

      const { user } = activeSession;
      if (profileSyncs.has(user.id)) {
        return profileSyncs.get(user.id);
      }

      setIsLoadingProfile(true);
      const syncPromise = (async () => {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (isMountedRef.current) {
          setUserProfile(profile || {
            id: user.id,
            username: user.email || '',
            preferred_name: 'friend',
            xp: 0,
          });
        }
      })()
        .catch((error) => {
          console.error('Failed to load the user profile:', error);
          if (isMountedRef.current) {
            setAuthFeedback({
              type: 'error',
              text: `Could not load your profile: ${error.message}`,
            });
          }
        })
        .finally(() => {
          if (isMountedRef.current) {
            setIsLoadingProfile(false);
          }
        })
        .finally(() => profileSyncs.delete(user.id));

      profileSyncs.set(user.id, syncPromise);
      return syncPromise;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoadingSession(false);
      }
      if (!nextSession) {
        setUserProfile(null);
        setIsLoadingProfile(false);
      }
      if (nextSession) {
        Promise.resolve().then(() => ensureProfile(nextSession));
      }
    });

    supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) {
          throw error;
        }
        if (isMounted) {
          setSession(data.session);
          setIsLoadingSession(false);
        }
        if (data.session) {
          await ensureProfile(data.session);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAuthFeedback({ type: 'error', text: error.message });
          setIsLoadingSession(false);
        }
      });

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if ('speechSynthesis' in window) {
      speechRequestRef.current += 1;
      if (voicesChangedHandlerRef.current) {
        window.speechSynthesis.removeEventListener(
          'voiceschanged',
          voicesChangedHandlerRef.current,
        );
      }
      window.speechSynthesis.cancel();
    }
  }, []);

  const authenticate = async (action) => {
    setAuthFeedback(null);
    if (action === 'signup' && password !== confirmPassword) {
      setAuthFeedback({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setIsAuthenticating(true);

    try {
      const { data, error } = action === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              preferred_name: preferredName,
              username,
            },
          },
        });

      if (error) {
        throw error;
      }

      setSession(data.session);
      if (action === 'signup' && !data.session) {
        setAuthFeedback({
          type: 'success',
          text: 'Account created. Check your email to confirm it, then log in.',
        });
      }
    } catch (error) {
      setAuthFeedback({ type: 'error', text: error.message });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const sendPasswordReset = async (event) => {
    event.preventDefault();
    setAuthFeedback(null);
    setIsSendingReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:3000/update-password',
      });
      if (error) {
        throw error;
      }

      setAuthFeedback({
        type: 'success',
        text: 'Password reset link sent to your email!',
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      setAuthFeedback({
        type: 'error',
        text: error.message || 'Could not send the password reset email. Please try again.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const logOut = async () => {
    setIsAuthenticating(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setSession(null);
      setUserProfile(null);
      setShowAdmin(false);
      setCurrentView('dashboard');
      setActiveCourse(null);
      navigate('/login', { replace: true });
    } catch (error) {
      setAuthFeedback({ type: 'error', text: error.message });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const cancelSpeech = () => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    speechRequestRef.current += 1;
    if (voicesChangedHandlerRef.current) {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        voicesChangedHandlerRef.current,
      );
      voicesChangedHandlerRef.current = null;
    }
    window.speechSynthesis.cancel();
  };

  const speakText = (text, pitch = 1) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      return;
    }

    const requestId = speechRequestRef.current;
    const synthesis = window.speechSynthesis;
    const speakWhenReady = () => {
      if (speechRequestRef.current !== requestId) {
        return;
      }

      const voices = synthesis.getVoices();
      if (voices.length === 0) {
        const handleVoicesChanged = () => {
          if (speechRequestRef.current !== requestId) {
            synthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            if (voicesChangedHandlerRef.current === handleVoicesChanged) {
              voicesChangedHandlerRef.current = null;
            }
            return;
          }
          if (synthesis.getVoices().length === 0) {
            return;
          }
          synthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          if (voicesChangedHandlerRef.current === handleVoicesChanged) {
            voicesChangedHandlerRef.current = null;
          }
          speakWhenReady();
        };

        voicesChangedHandlerRef.current = handleVoicesChanged;
        synthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged();
        return;
      }

      const preferredVoice = voices.find((voice) => (
        voice.name.toLowerCase().includes('google uk english female')
      )) || voices.find((voice) => voice.name.toLowerCase().includes('samantha'))
        || voices.find((voice) => voice.name.toLowerCase().includes('female'))
        || voices.find((voice) => voice.name.toLowerCase().includes('zira'))
        || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
      const utterance = new window.SpeechSynthesisUtterance(text);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.rate = 0.97;
      utterance.pitch = pitch;
      synthesis.speak(utterance);
    };

    speakWhenReady();
  };

  const toggleListening = () => {
    if (!speechRecognitionSupported || isSending) {
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      if (recognitionRef.current === recognition) {
        setIsListening(true);
      }
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current === recognition) {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          void sendMessage(null, transcript);
        }
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
    };
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          sender: 'bablu',
          text: 'Voice input could not be started. Check microphone permissions and try again.',
          isError: true,
        },
      ]);
    }
  };

  const sendMessage = async (event, recognizedMessage) => {
    event?.preventDefault();
    const userMessage = (recognizedMessage ?? message).trim();

    if (!userMessage || isSending) {
      return;
    }

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    cancelSpeech();

    const updatedChatHistory = [
      ...chatHistory,
      { role: 'user', content: userMessage },
    ];
    setChatHistory(updatedChatHistory);
    setMessages((currentMessages) => [
      ...currentMessages,
      { sender: 'you', text: userMessage },
    ]);
    setMessage('');
    setIsSending(true);
    const thinkingPhrases = ['Hmm, let me think...', 'One moment...', 'Analyzing...'];
    speakText(thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)], 0.9);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: updatedChatHistory,
          userMessage,
          userName: userProfile?.preferred_name || userProfile?.username || 'friend',
          userQuota: quota,
          courseTitle: activeCourse?.title || '',
          courseSyllabus: activeCourse?.syllabus_text || '',
        }),
      });

      if (!response.ok) {
        throw new Error('The server could not answer. Please try again.');
      }

      const data = await response.json();
      if (typeof data.dialogue !== 'string') {
        throw new Error('The server sent an unexpected response.');
      }

      if (typeof data.xp_change === 'number' && Number.isFinite(data.xp_change)) {
        const currentXp = userProfile?.xp || 0;
        const newXp = currentXp + data.xp_change > 100
          ? 0
          : Math.max(0, currentXp + data.xp_change);
        setUserProfile((currentProfile) => (
          currentProfile ? { ...currentProfile, xp: newXp } : currentProfile
        ));

        if (session?.user?.id) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ xp: newXp })
            .eq('id', session.user.id);
          if (updateError) {
            console.error('Failed to save profile XP:', updateError);
            setAuthFeedback({
              type: 'error',
              text: `Your XP was updated for this session but could not be saved: ${updateError.message}`,
            });
          }
        }
      }
      if (data.deduct_quota === true) {
        setQuota((currentQuota) => Math.max(0, currentQuota - 1));
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        { sender: 'bablu', text: data.dialogue },
      ]);
      setChatHistory((currentHistory) => [
        ...currentHistory,
        { role: 'assistant', content: data.dialogue },
      ]);
      cancelSpeech();
      speakText(data.dialogue);
      return data.dialogue;
    } catch (error) {
      cancelSpeech();
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          sender: 'bablu',
          text: error.message || 'Could not connect to the chat server. Please try again.',
          isError: true,
        },
      ]);
      return null;
    } finally {
      setIsSending(false);
    }
  };

  const startLearning = (course) => {
    navigate(`/learn/${encodeURIComponent(course.id)}`);
    setActiveCourse(course);
    setChatHistory([{
      role: 'system',
      content: `The learner is studying the course "${course.title}". Use this syllabus to keep your tutoring relevant to the course:\n${course.syllabus_text}`,
    }]);
    setMessages([]);
    setMessage('');
    setCurrentView('blackboard');
  };

  const returnToDashboard = () => {
    navigate('/login');
    setCurrentView('dashboard');
    setActiveCourse(null);
  };

  if (LegalPageRoute) {
    return <LegalPageRoute />;
  }

  if (isLoadingSession) {
    return (
      <main className={`app-shell ${theme}-mode`}>
        <p className="auth-loading" role="status">Checking your session…</p>
      </main>
    );
  }

  if (session && isLoadingProfile) {
    return (
      <main className={`app-shell ${theme}-mode`}>
        <p className="auth-loading" role="status">Loading your profile…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`app-shell ${theme}-mode auth-shell`}>
        <div className="auth-experience">
          <section className="avatar-pod" aria-label="Bablu AI avatar">
            <div className="avatar-pod-grid" aria-hidden="true" />
            <Avatar3D
              className="avatar-3d-container"
              currentAction="waving"
              isTalking={false}
              isPasswordFocused={isPasswordFocused}
            />
            <div className="avatar-caption">
              <span className="avatar-status-dot" />
              <span> BABLU AI · ONLINE</span>
            </div>
            <p className="avatar-tagline">Your learning companion,<br />ready to come online.</p>
          </section>

          <section className="auth-card" aria-labelledby="auth-title">
            <div className="auth-form-topline">
              <div>
                <p className="quest-label">LEARNING QUEST / ACCOUNT</p>
                <h1 id="auth-title">
                  {isResetting
                    ? 'Reset your password'
                    : authMode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="auth-intro">
                  {isResetting
                    ? 'Enter your email and we’ll send you a password reset link.'
                    : authMode === 'login'
                      ? 'Sign in to continue your learning journey.'
                      : 'Set up your profile and start learning with Bablu.'}
                </p>
              </div>
              <div className="auth-brand" aria-hidden="true">✦</div>
            </div>

            {!isResetting && (
              <div className="auth-mode-toggle" role="tablist" aria-label="Account access">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'login'}
                  className={authMode === 'login' ? 'auth-mode-active' : ''}
                  onClick={() => {
                    setAuthMode('login');
                    setAuthFeedback(null);
                  }}
                  disabled={isAuthenticating}
                >
                  Log In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  className={authMode === 'signup' ? 'auth-mode-active' : ''}
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthFeedback(null);
                  }}
                  disabled={isAuthenticating}
                >
                  Sign Up
                </button>
              </div>
            )}

            {isResetting ? (
              <form className="auth-form" onSubmit={sendPasswordReset}>
                <div className="auth-field">
                  <label htmlFor="auth-reset-email">Email</label>
                  <input
                    id="auth-reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="auth-actions">
                  <button type="submit" disabled={isSendingReset}>
                    {isSendingReset ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </div>
                <button
                  className="auth-text-button"
                  type="button"
                  onClick={() => {
                    setIsResetting(false);
                    setAuthFeedback(null);
                  }}
                  disabled={isSendingReset}
                >
                  Back to Log In
                </button>
              </form>
            ) : (
            <form className="auth-form" onSubmit={(event) => {
              event.preventDefault();
              authenticate(authMode);
            }}>
              {authMode === 'signup' && (
                <>
                  <div className="auth-field-row">
                    <div className="auth-field">
                      <label htmlFor="auth-first-name">First Name</label>
                      <input
                        id="auth-first-name"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <label htmlFor="auth-last-name">Last Name</label>
                      <input
                        id="auth-last-name"
                        type="text"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="auth-field-row">
                    <div className="auth-field">
                      <label htmlFor="auth-preferred-name">Preferred Name</label>
                      <input
                        id="auth-preferred-name"
                        type="text"
                        autoComplete="nickname"
                        value={preferredName}
                        onChange={(event) => setPreferredName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <label htmlFor="auth-username">Username</label>
                      <input
                        id="auth-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="auth-field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="auth-password">Password</label>
                <div className="password-input-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    required
                  />
                  <button
                    className="password-visibility-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {showPassword ? (
                        <>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.3 2.3-2.6 3.5M6.2 6.2C3.9 7.7 2.7 9.8 2.5 12c.5 1.2 1.7 3 3.8 4.5A10 10 0 0 0 12 19c1 0 1.9-.2 2.8-.5" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {authMode === 'login' && (
                  <button
                    className="forgot-password-link"
                    type="button"
                    onClick={() => {
                      setIsResetting(true);
                      setAuthFeedback(null);
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              {authMode === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm-password">Confirm Password</label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              )}
              <div className="auth-actions">
                <button type="submit" disabled={isAuthenticating}>
                  {isAuthenticating
                    ? 'Please wait…'
                    : authMode === 'signup' ? 'Create Account' : 'Log In'}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>
            )}
            {authFeedback && (
              <p className={`auth-feedback auth-feedback-${authFeedback.type}`} role={authFeedback.type === 'error' ? 'alert' : 'status'}>
                {authFeedback.text}
              </p>
            )}
            <p className="auth-security-note"><span aria-hidden="true">⌑</span> Secure sign-in · Your learning data stays private</p>
          </section>
        </div>
        <LegalFooter />
      </main>
    );
  }

  const isAdmin = session.user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <main className={`app-shell ${theme}-mode`}>
      <div className={`game-layout ${theme}-mode ${currentView === 'chat' ? 'game-layout-learning' : ''}`}>
        <header className="rpg-header" aria-label="Learning progress">
          <div className="rpg-header-title">
            <span className="quest-icon" aria-hidden="true">✦</span>
            <div>
              <p className="quest-label">LEARNING QUEST</p>
              <h2>Adventurer Status</h2>
            </div>
          </div>
          <div className="rpg-stats">
            <div className="xp-stat">
              <div className="xp-label">
                <span>XP</span>
                <span>{userProfile?.xp ?? 0} / 100</span>
              </div>
              <progress
                className="xp-progress"
                max="100"
                value={userProfile?.xp ?? 0}
                aria-label={`Experience points: ${userProfile?.xp ?? 0} of 100`}
              />
            </div>
            <div className="quota-stat" aria-label={`${quota} quota remaining`}>
              <span className="quota-icon" aria-hidden="true">◇</span>
              <span>Quota</span>
              <strong>{quota}</strong>
            </div>
            <button
              className="logout-button"
              type="button"
              onClick={logOut}
              disabled={isAuthenticating}
            >
              Log Out
            </button>
            {isAdmin && (
              <button
                className="admin-nav-button"
                type="button"
                onClick={() => setShowAdmin((currentShowAdmin) => !currentShowAdmin)}
              >
                Admin Panel
              </button>
            )}
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme((currentTheme) => (
                currentTheme === 'dark' ? 'light' : 'dark'
              ))}
              aria-label="Toggle Theme"
              title="Toggle Theme"
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              <span>Toggle Theme</span>
            </button>
          </div>
        </header>
        {authFeedback && (
          <p className={`auth-feedback auth-feedback-${authFeedback.type}`} role="alert">
            {authFeedback.text}
          </p>
        )}

        {showAdmin && isAdmin ? (
          <Admin
            onBack={() => setShowAdmin(false)}
            accessToken={session.access_token}
            onLaunchStatusChange={onLaunchStatusChange}
          />
        ) : currentView === 'dashboard' ? (
          <Dashboard
            userId={session.user.id}
            userEmail={session.user.email || ''}
            preferredName={userProfile?.preferred_name || ''}
            username={userProfile?.username || ''}
            onStartLearning={startLearning}
          />
        ) : (
          <Blackboard
            activeCourse={activeCourse}
            messages={messages}
            message={message}
            setMessage={setMessage}
            sendMessage={sendMessage}
            isSending={isSending}
            isListening={isListening}
            toggleListening={toggleListening}
            speechRecognitionSupported={speechRecognitionSupported}
            onBack={returnToDashboard}
          />
        )}
      </div>
      <LegalFooter />
    </main>
  );
}

function ProtectedLearnRoute({ onLaunchStatusChange }) {
  const { courseId } = useParams();
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [accessStatus, setAccessStatus] = useState('loading');
  const [accessError, setAccessError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoadingSession(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        if (isMounted) {
          setSession(data.session);
          setIsLoadingSession(false);
        }
      })
      .catch((error) => {
        console.error('Failed to check the learning-route session:', error);
        if (isMounted) {
          setSession(null);
          setIsLoadingSession(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoadingSession) {
      return undefined;
    }

    let isMounted = true;
    setAccessStatus('loading');
    setAccessError(null);

    const verifyAccess = async () => {
      if (!session?.user?.id) {
        setAccessStatus('redirect');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            username: session.user.email,
            xp: 0,
          });
        if (insertError) {
          throw insertError;
        }
      }

      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', session.user.id)
        .eq('course_id', courseId)
        .eq('has_access', true)
        .maybeSingle();
      if (enrollmentError) {
        throw enrollmentError;
      }

      if (isMounted) {
        setAccessStatus(enrollment ? 'allowed' : 'redirect');
      }
    };

    verifyAccess().catch((error) => {
      console.error('Failed to verify learning-route access:', error);
      if (isMounted) {
        setAccessError(error);
        setAccessStatus('error');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [courseId, isLoadingSession, session]);

  if (isLoadingSession || accessStatus === 'loading') {
    return (
      <main className="app-shell">
        <p className="auth-loading" role="status">Verifying course access…</p>
      </main>
    );
  }

  if (accessStatus === 'redirect') {
    return <Navigate to="/dashboard" replace />;
  }

  if (accessStatus === 'error') {
    return (
      <main className="app-shell">
        <p className="admin-error" role="alert">
          Could not verify your course access: {accessError?.message || 'Please try again.'}
        </p>
        <a className="legal-back-link" href="/dashboard">Back to Dashboard</a>
      </main>
    );
  }

  return <LearningApp onLaunchStatusChange={onLaunchStatusChange} />;
}

function RootRoute({ isLaunched, onLaunchComplete }) {
  if (isLaunched) {
    return <LandingPage />;
  }

  return <LaunchGate onLaunchComplete={onLaunchComplete} />;
}

function DashboardRoute({ onLaunchStatusChange }) {
  return (
    <motion.div
      className="min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
    >
      <LearningApp onLaunchStatusChange={onLaunchStatusChange} />
    </motion.div>
  );
}

function SiteAvailabilityRoute({
  isLaunched,
  isLoadingLaunchStatus,
  launchStatusError,
}) {
  const location = useLocation();

  if (isLoadingLaunchStatus) {
    return (
      <main className="app-shell">
        <p className="auth-loading" role="status">Checking website availability…</p>
      </main>
    );
  }

  if (launchStatusError) {
    return (
      <main className="app-shell">
        <p className="admin-error" role="alert">
          Could not load website launch status: {launchStatusError.message}
        </p>
      </main>
    );
  }

  if (!isLaunched && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function App() {
  const [isLaunched, setIsLaunched] = useState(false);
  const [isLoadingLaunchStatus, setIsLoadingLaunchStatus] = useState(true);
  const [launchStatusError, setLaunchStatusError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadLaunchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('id, is_launched')
          .eq('id', 1)
          .maybeSingle();
        if (error) {
          throw error;
        }
        if (!data) {
          throw new Error('The site_settings row with id 1 was not found.');
        }
        if (typeof data.is_launched !== 'boolean') {
          throw new Error('The site launch status is not a boolean value.');
        }

        if (isMounted) {
          setIsLaunched(data.is_launched);
          setLaunchStatusError(null);
        }
      } catch (error) {
        console.error('Failed to load website launch status:', error);
        if (isMounted) {
          setLaunchStatusError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLaunchStatus(false);
        }
      }
    };

    loadLaunchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLaunchStatusChange = useCallback(
    (nextLaunchStatus) => setIsLaunched(nextLaunchStatus),
    [],
  );
  const handleLaunchComplete = useCallback(() => setIsLaunched(true), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={(
            <SiteAvailabilityRoute
              isLaunched={isLaunched}
              isLoadingLaunchStatus={isLoadingLaunchStatus}
              launchStatusError={launchStatusError}
            />
          )}
        >
          <Route
            path="/"
            element={(
              <RootRoute
                isLaunched={isLaunched}
                onLaunchComplete={handleLaunchComplete}
              />
            )}
          />
          <Route
            path="/dashboard"
            element={<DashboardRoute onLaunchStatusChange={handleLaunchStatusChange} />}
          />
          <Route
            path="/login"
            element={<LearningApp onLaunchStatusChange={handleLaunchStatusChange} />}
          />
          <Route
            path="/learn/:courseId"
            element={<ProtectedLearnRoute onLaunchStatusChange={handleLaunchStatusChange} />}
          />
          <Route
            path="/privacy"
            element={<LearningApp onLaunchStatusChange={handleLaunchStatusChange} />}
          />
          <Route
            path="/terms"
            element={<LearningApp onLaunchStatusChange={handleLaunchStatusChange} />}
          />
          <Route
            path="/refund"
            element={<LearningApp onLaunchStatusChange={handleLaunchStatusChange} />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;