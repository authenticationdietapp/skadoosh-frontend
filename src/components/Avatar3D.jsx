import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  useGLTF,
} from '@react-three/drei';

const MODEL_PATH = '/bablu_animated.glb';

export function AvatarModel({
  position = [0, -0.9, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    const time = clock.elapsedTime;
    groupRef.current.rotation.y = rotation[1] + Math.sin(time * 0.6) * 0.12;
    groupRef.current.scale.set(
      scale[0],
      scale[1] * (1 + Math.sin(time * 1.2) * 0.005),
      scale[2],
    );
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function Avatar3D({
  className = '',
  showShadow = true,
}) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.15, 3.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => event.preventDefault());
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 3]} intensity={1.3} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <AvatarModel />
          {showShadow && (
            <ContactShadows
              position={[0, -1, 0]}
              opacity={0.35}
              scale={5}
              blur={2.5}
              far={4}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);

export default Avatar3D;
