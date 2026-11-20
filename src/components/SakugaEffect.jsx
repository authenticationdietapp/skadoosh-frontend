import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// VFX: KanaWorks_AI (@KanaWorks_AI) - https://github.com/kanaworksai-hue/kanaworks-sakuga-vfx
const SPRITE_URL = '/sakuga/fire_impact_01.png';
const METADATA_URL = '/sakuga/fire_impact_01.flipbook.json';

function SakugaEffect({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  play = false,
}) {
  const texture = useLoader(THREE.TextureLoader, SPRITE_URL);
  const [metadata, setMetadata] = useState(null);
  const [metadataError, setMetadataError] = useState(null);
  const elapsedRef = useRef(0);
  const playingRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const controller = new AbortController();

    fetch(METADATA_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load Sakuga metadata (${response.status}).`);
        }
        return response.json();
      })
      .then((data) => {
        if (
          !Array.isArray(data.grid) ||
          data.grid.length !== 2 ||
          !data.grid.every((size) => Number.isInteger(size) && size > 0) ||
          !Number.isInteger(data.frames) ||
          data.frames <= 0 ||
          typeof data.fps !== 'number' ||
          !Number.isFinite(data.fps) ||
          data.fps <= 0
        ) {
          throw new Error('Sakuga metadata has invalid grid, frame count, or FPS values.');
        }
        setMetadata(data);
        setMetadataError(null);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to initialize the Sakuga effect:', error);
          setMetadataError(error);
        }
      });

    return () => controller.abort();
  }, []);

  const sprite = useMemo(() => {
    if (!metadata) {
      return null;
    }

    const [columns, rows] = metadata.grid;
    const spriteTexture = texture.clone();
    spriteTexture.colorSpace = THREE.SRGBColorSpace;
    spriteTexture.repeat.set(1 / columns, 1 / rows);
    spriteTexture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: spriteTexture,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,
    });
    const result = new THREE.Sprite(material);
    result.visible = false;
    return result;
  }, [metadata, texture]);

  useEffect(() => {
    if (sprite) {
      sprite.position.set(...position);
      sprite.scale.set(...scale);
    }
  }, [position, scale, sprite]);

  useEffect(() => {
    if (!sprite) {
      return undefined;
    }

    if (play) {
      elapsedRef.current = 0;
      playingRef.current = true;
      sprite.visible = true;
      invalidate();
    } else {
      playingRef.current = false;
      sprite.visible = false;
    }

    return undefined;
  }, [invalidate, play, sprite]);

  useFrame((_, delta) => {
    if (!sprite || !metadata || !playingRef.current) {
      return;
    }

    elapsedRef.current += delta;
    const frame = Math.floor(elapsedRef.current * metadata.fps);
    if (frame >= metadata.frames) {
      playingRef.current = false;
      sprite.visible = false;
      return;
    }

    const [columns, rows] = metadata.grid;
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    const map = sprite.material.map;
    map.offset.set(column / columns, 1 - (row + 1) / rows);
    invalidate();
  });

  useEffect(() => () => {
    if (sprite) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
  }, [sprite]);

  if (metadataError || !sprite) {
    return null;
  }

  return <primitive object={sprite} />;
}

export default SakugaEffect;
