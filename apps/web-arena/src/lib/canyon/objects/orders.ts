import * as THREE from "three";
import { FS_POINT, ORDERS_VS } from "../shaders";
import { setAttrs, shaderMat, staged, type Uniforms } from "./util";

/** Orders in flight: agent → resting place on the "now" face. Agent 5 = arbitrage stream from the pool bead. */
export function buildOrders(U: Uniforms, OU: Uniforms, mobile: boolean): THREE.Points {
  const N = mobile ? 150 : 300, TR = 3, n = N * TR + 60 * TR;
  const f = () => new Float32Array(n);
  const aAgent = f(), aSide = f(), aU = f(), aPhase = f(), aSpeed = f(), aTrail = f();
  const AGENT_MIX = [0, 1, 2, 2, 2, 3, 3, 3, 2, 4];
  let i = 0;
  for (let k = 0; k < N + 60; k++) {
    const arb = k >= N;
    const ag = arb ? 5 : AGENT_MIX[k % 10];
    const side = Math.random() < 0.5 ? -1 : 1;
    const u = arb ? 0 : Math.pow(Math.random(), 2.2) * 0.8;
    const ph = Math.random();
    const sp = (arb ? 0.5 : 0.16) + Math.random() * 0.22;
    for (let t = 0; t < TR; t++) {
      aAgent[i] = ag; aSide[i] = side; aU[i] = u; aPhase[i] = ph; aSpeed[i] = sp; aTrail[i] = t; i++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  setAttrs(g, { aAgent, aSide, aU, aPhase, aSpeed, aTrail });
  return staged(new THREE.Points(g, shaderMat(U, ORDERS_VS, FS_POINT, OU)), 6);
}
