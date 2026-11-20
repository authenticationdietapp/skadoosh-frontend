import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, Stars } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { AvatarModel } from '../components/Avatar3D';
import { LegalFooter } from './LegalPage';

function FloatingShape({ children, position, speed, rotationIntensity, floatIntensity }) {
  return (
    <Float
      speed={speed}
      rotationIntensity={rotationIntensity}
      floatIntensity={floatIntensity}
    >
      <group position={position}>{children}</group>
    </Float>
  );
}

function LandingScene() {
  return (
    <Canvas
      className="landing-canvas"
      camera={{ position: [0, 1, 6], fov: 45 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#080b18']} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="city" />
      <ambientLight intensity={1} />
      <directionalLight position={[4, 5, 5]} intensity={1.5} />
      <pointLight position={[-3, 1, 3]} color="#8b5cf6" intensity={20} distance={10} />
      <Suspense fallback={null}>
        <FloatingShape
          position={[-2.8, 1.8, -1.5]}
          speed={1.4}
          rotationIntensity={0.8}
          floatIntensity={0.5}
        >
          <mesh>
            <torusGeometry args={[0.55, 0.035, 16, 100]} />
            <meshStandardMaterial
              color="#8b5cf6"
              emissive="#6d28d9"
              emissiveIntensity={2}
              metalness={0.55}
              roughness={0.25}
            />
          </mesh>
        </FloatingShape>
        <FloatingShape
          position={[2.8, 1.7, -2]}
          speed={1.1}
          rotationIntensity={1}
          floatIntensity={0.65}
        >
          <mesh>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#2563eb"
              emissiveIntensity={1.8}
              metalness={0.7}
              roughness={0.2}
              wireframe
            />
          </mesh>
        </FloatingShape>
        <FloatingShape
          position={[-3.4, -1.45, -1]}
          speed={1.7}
          rotationIntensity={0.6}
          floatIntensity={0.35}
        >
          <mesh>
            <octahedronGeometry args={[0.38, 0]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#0891b2"
              emissiveIntensity={1.7}
              metalness={0.5}
              roughness={0.25}
            />
          </mesh>
        </FloatingShape>
        <FloatingShape
          position={[3.5, -0.75, -1.8]}
          speed={1.25}
          rotationIntensity={1.1}
          floatIntensity={0.55}
        >
          <mesh>
            <torusGeometry args={[0.34, 0.07, 12, 64]} />
            <meshStandardMaterial
              color="#a78bfa"
              emissive="#7c3aed"
              emissiveIntensity={1.8}
              metalness={0.65}
              roughness={0.2}
            />
          </mesh>
        </FloatingShape>
        <AvatarModel
          position={[1.8, -1.5, 0]}
          rotation={[0, -0.25, 0]}
          scale={[1.5, 1.5, 1.5]}
        />
      </Suspense>
    </Canvas>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="landing-page">
      <div className="landing-scene">
        <LandingScene />
      </div>
      <div className="landing-overlay">
        <section className="landing-copy">
          <div className="landing-glass-panel">
            <p className="landing-badge"><span aria-hidden="true">🚀</span> The Future of Learning</p>
            <h1>Master Job-Ready Skills with your AI Tutor.</h1>
            <p className="landing-description">
              Learn with Bablu, your personal AI guide. Turn ambitious goals into
              practical skills with interactive courses and a tutor that helps you
              keep moving forward.
            </p>
            <ul className="landing-course-list" aria-label="Featured courses">
              <li><span aria-hidden="true">✓</span> PMP Certification</li>
              <li><span aria-hidden="true">✓</span> Agile Project Management</li>
              <li><span aria-hidden="true">✓</span> Artificial Intelligence</li>
            </ul>
            <button
              className="landing-cta"
              type="button"
              onClick={() => navigate('/login')}
            >
              Get Started <span aria-hidden="true">↗</span>
            </button>
          </div>
          <LegalFooter />
        </section>
      </div>
    </main>
  );
}

export default LandingPage;
