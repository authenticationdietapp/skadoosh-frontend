import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Text } from '@react-three/drei';
import { AvatarModel } from './components/Avatar3D.jsx';

const DEFAULT_BOARD_TEXT = 'Chapter 1\nWelcome to Chapter 1. Today we will learn about Project Management.';
const BACKEND_ERROR_TEXT = "Bablu: I'm having trouble connecting to my brain right now. Please check the backend server or try again in a moment.";

function ClassroomScene({ boardText }) {
  return (
    <Canvas
      className="blackboard-scene-canvas"
      camera={{ position: [0, 0, 9], fov: 45 }}
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }}
      frameloop="demand"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => event.preventDefault());
      }}
    >
      <Environment preset="city" />
      <ambientLight intensity={1.5} />
      <spotLight
        position={[0, 5, 5]}
        target-position={[0, 0, 0]}
        intensity={3.5}
        angle={0.8}
        penumbra={0.6}
        castShadow
      />
      <directionalLight position={[0, 3, 5]} intensity={2.5} />
      <group position={[-2, 0, 0]}>
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[6, 3.5, 0.2]} />
          <meshStandardMaterial color="#5c3a21" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[5.6, 3.1, 0.1]} />
          <meshStandardMaterial color="#1b4d3e" />
        </mesh>
      </group>
      <Text
        color="#f8f8f8"
        fontSize={0.2}
        maxWidth={4.5}
        lineHeight={1.4}
        textAlign="left"
        anchorX="left"
        anchorY="top"
        position={[-4.2, 1.2, 0.1]}
        outlineWidth={0.005}
        outlineColor="white"
      >
        {boardText}
      </Text>
      <Suspense fallback={null}>
        <AvatarModel
          position={[2.2, -1.75, 0]}
          rotation={[0, -0.4, 0]}
          scale={[1.9, 1.9, 1.9]}
        />
      </Suspense>
      <ContactShadows
        position={[2.2, -2.5, 0]}
        opacity={0.42}
        scale={3.5}
        blur={2.5}
        far={3}
      />
    </Canvas>
  );
}

function Blackboard({
  activeCourse,
  messages,
  message,
  setMessage,
  sendMessage,
  isSending,
  isListening,
  toggleListening,
  speechRecognitionSupported,
  onBack,
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [input, setInput] = useState('');
  const [boardText, setBoardText] = useState(() => {
    try {
      return window.sessionStorage.getItem('boardText') || DEFAULT_BOARD_TEXT;
    } catch (error) {
      console.error('Could not restore Blackboard text from session storage:', error);
      return DEFAULT_BOARD_TEXT;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const updateBoardText = useCallback((newText) => {
    setBoardText(newText);
    try {
      window.sessionStorage.setItem('boardText', newText);
    } catch (error) {
      console.error('Could not save Blackboard text to session storage:', error);
    }
  }, []);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateBoardText(latestMessage.isError
        ? BACKEND_ERROR_TEXT
        : `${latestMessage.sender === 'you' ? 'You: ' : 'Bablu:\n'}${latestMessage.text}`);
    }
  }, [messages, updateBoardText]);

  const handleSendMessage = async () => {
    const userInput = input.trim();
    if (!userInput || isLoading || isSending) {
      return;
    }

    setInput('');
    setMessage('');
    setIsLoading(true);
    updateBoardText(`You: ${userInput}`);

    try {
      const response = await sendMessage(null, userInput);
      updateBoardText(typeof response === 'string' && response.trim()
        ? `Bablu:\n${response}`
        : BACKEND_ERROR_TEXT);
    } catch (error) {
      console.error('Failed to send a Blackboard message:', error);
      updateBoardText(BACKEND_ERROR_TEXT);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className={`blackboard-layout ${isFullScreen ? 'blackboard-layout-fullscreen' : ''}`}
      aria-label="Course lesson with Bablu"
    >
      <header className="lesson-board-header">
        <div>
          <p className="quest-label">NOW LEARNING</p>
          <h1>{activeCourse?.title || 'Blackboard'}</h1>
          {activeCourse && (
            <p className="blackboard-course-label">Currently Learning: {activeCourse.title}</p>
          )}
        </div>
        <button className="dashboard-back-button" type="button" onClick={onBack}>
          Back to Dashboard
        </button>
      </header>

      <div className="blackboard-scene">
        <button
          className="blackboard-fullscreen-button"
          type="button"
          onClick={() => setIsFullScreen((currentValue) => !currentValue)}
          aria-label={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isFullScreen ? (
              <path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5" />
            ) : (
              <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
            )}
          </svg>
          <span>{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
        <ClassroomScene boardText={boardText} />
      </div>

      <div className="blackboard-composer-dock">
        <form
          className="blackboard-composer"
          onSubmit={(event) => {
            event.preventDefault();
            handleSendMessage();
          }}
        >
          <label className="visually-hidden" htmlFor="blackboard-response">
            Your message
          </label>
          <input
            id="blackboard-response"
            type="text"
            placeholder="Write your answer..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading || isSending}
          />
          <button
            className={`mic-button ${isListening ? 'mic-button-listening' : ''}`}
            type="button"
            onClick={toggleListening}
            disabled={!speechRecognitionSupported || isLoading || isSending}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={isListening}
            title={speechRecognitionSupported ? 'Use voice input' : 'Voice input is not supported in this browser'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M19 11a7 7 0 0 1-14 0M12 18v4m-4 0h8" />
            </svg>
          </button>
          <button type="submit" disabled={!input.trim() || isLoading || isSending}>
            <span>{isLoading || isSending ? 'Thinking...' : 'Send'}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="composer-hint">Press Enter to send</p>
      </div>
    </section>
  );
}

export default Blackboard;
