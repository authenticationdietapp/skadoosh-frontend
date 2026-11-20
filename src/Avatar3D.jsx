import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Float, Environment, ContactShadows } from "@react-three/drei";

function BabluModel() {
  const { scene } = useGLTF("/bablu.glb");

  return (
    <primitive
      object={scene}
      scale={1.2}
      position={[0, -1, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

export default function Avatar3D({ className = "" }) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0.5, 4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          <Environment preset="city" />

          <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.4}>
            <BabluModel />
          </Float>

          <ContactShadows
            position={[0, -1.4, 0]}
            opacity={0.35}
            scale={6}
            blur={2.5}
            far={4}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/bablu.glb");