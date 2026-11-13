import * as THREE from "three";
import { BG_FS, BG_VS, GATE_BG_FS } from "../shaders";
import { staged } from "./util";

/** Full-screen quad: ink + a horizon band at the projected vanishing point, calm → hot with shock. */
export function buildBackground(gate: boolean) {
  const uniforms: Record<string, THREE.IUniform<number>> = gate
    ? { uHor: { value: 0.3 }, uOn: { value: 0 } }
    : { uHor: { value: 0.2 }, uHeat: { value: 0 }, uAspect: { value: 1 } };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: BG_VS,
      fragmentShader: gate ? GATE_BG_FS : BG_FS,
    }),
  );
  return { mesh: staged(mesh, -10), uniforms };
}
