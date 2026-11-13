import * as THREE from "three";
import { staged } from "./util";

export const EDGE_SEG = 14;

const lineMat = () =>
  new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

/** Graph edges (every agent → the touch and → the pool bead) and score stems. CPU-updated; vertex colour = intensity. */
export function buildEdges(): { tether: THREE.LineSegments; stems: THREE.LineSegments } {
  const n = 5 * (EDGE_SEG + EDGE_SEG) * 2;
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 2 * 3), 3));
  sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(4 * 2 * 3), 3));
  return { tether: staged(new THREE.LineSegments(tg, lineMat()), 5), stems: staged(new THREE.LineSegments(sg, lineMat()), 5) };
}

/** Writes quadratic Bézier edges into a tether geometry without allocating. */
export class EdgeWriter {
  private v = 0;
  private readonly ctl = new THREE.Vector3();
  private readonly p0 = new THREE.Vector3();
  private readonly p1 = new THREE.Vector3();
  constructor(private readonly geo: THREE.BufferGeometry) {}

  begin(): void { this.v = 0; }

  private bez(out: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, t: number): void {
    const it = 1 - t, c = this.ctl;
    out.set(
      it * it * from.x + 2 * it * t * c.x + t * t * to.x,
      it * it * from.y + 2 * it * t * c.y + t * t * to.y,
      it * it * from.z + 2 * it * t * c.z + t * t * to.z,
    );
  }

  edge(from: THREE.Vector3, to: THREE.Vector3, lift: number, col: THREE.Vector3, inten: number): void {
    const tp = this.geo.attributes.position as THREE.BufferAttribute, tc = this.geo.attributes.color as THREE.BufferAttribute;
    this.ctl.lerpVectors(from, to, 0.5);
    this.ctl.y += lift;
    const r = col.x * inten, g = col.y * inten, b = col.z * inten;
    for (let q = 0; q < EDGE_SEG; q++) {
      this.bez(this.p0, from, to, q / EDGE_SEG);
      this.bez(this.p1, from, to, (q + 1) / EDGE_SEG);
      tp.setXYZ(this.v, this.p0.x, this.p0.y, this.p0.z); tc.setXYZ(this.v, r, g, b); this.v++;
      tp.setXYZ(this.v, this.p1.x, this.p1.y, this.p1.z); tc.setXYZ(this.v, r, g, b); this.v++;
    }
  }

  end(): void {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
