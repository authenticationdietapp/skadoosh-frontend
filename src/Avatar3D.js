import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function BabluModel({ isLookingDown }) {
  const { scene } = useGLTF('/bablu.glb');
  const groupRef = useRef(null);
  const model = useMemo(() => {
    const clonedScene = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = size.y > 0 ? 2.7 / size.y : 1;
    return {
      scene: clonedScene,
      scale,
      position: [
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      ],
    };
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.07;
    const targetRotation = isLookingDown ? -0.08 : 0;
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      targetRotation,
      4,
      delta,
    );
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={model.scene}
        position={model.position}
        scale={model.scale}
      />
    </group>
  );
}

function Avatar3D({ isLookingDown = false }) {
  return (
    <div className="avatar-3d-container" aria-label="Interactive 3D Bablu avatar">
      <Canvas
        camera={{ position: [0, 1.55, 4.7], fov: 36 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={3} />
        <directionalLight position={[-3, 2, -2]} intensity={1.2} color="#83dfff" />
        <Suspense fallback={null}>
          <BabluModel isLookingDown={isLookingDown} />
        </Suspense>
        <OrbitControls
          target={[0, 1.35, 0]}
          enablePan={false}
          minDistance={3.2}
          maxDistance={6.2}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/bablu.glb');

export default Avatar3D;
