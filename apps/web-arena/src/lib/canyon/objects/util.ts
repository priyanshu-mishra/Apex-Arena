import * as THREE from "three";

export type Uniforms = Record<string, THREE.IUniform>;

export const hex = (h: string): THREE.Vector3 =>
  new THREE.Vector3(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );

/** Scene palette (guide §2). */
export const COLORS = {
  bid: hex("#45E0BC"),
  ask: hex("#FF5A45"),
  pool: hex("#6C9CFF"),
  shock: hex("#FFB020"),
  bone: hex("#EDEAE3"),
  grey: hex("#7C8794"),
} as const;

/** Every scene material: additive, no depth test, no depth write. Uniform objects are shared by reference. */
export const shaderMat = (
  shared: Uniforms,
  vertexShader: string,
  fragmentShader: string,
  extra: Uniforms = {},
): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...extra },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/** Mark an object as always drawn and give it a render order. */
export function staged<T extends THREE.Object3D>(o: T, order = 0): T {
  o.frustumCulled = false;
  o.renderOrder = order;
  return o;
}

export function setAttrs(g: THREE.BufferGeometry, attrs: Record<string, Float32Array>): void {
  for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, new THREE.BufferAttribute(a, 1));
}

/** Prototype's deterministic LCG (seed 42) for lattice jitter. */
export function lcg(seed = 42): () => number {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
