/**
 * GLSL for the Canyon scene, ported verbatim from the approved prototype
 * (docs/design/landing/index.html and gate.html). The market model here mirrors
 * `model.ts` exactly so the status line always matches the picture.
 */
import { MAX_COPY } from "./copy";
import { NEV, NL } from "./model";

/* ───────────── shared ───────────── */

export const GLSL_MARKET = /* glsl */ `
uniform float uT, uSpan, uLen, uW, uSplit, uPx, uDpr, uFocus, uAp, uExtent, uDim, uHist, uFace;
uniform vec3 uEv[${NEV}];
const float NL = ${NL}.;
float midBase(float t){ return .9*sin(t*.13)+.5*sin(t*.31+1.3)+.22*sin(t*.83+.7)+.07*sin(t*2.1+2.); }
void market(float tau, out float cx, out float hs, out float sh){
  cx = midBase(tau); hs = .16; sh = 0.;
  for(int i=0;i<${NEV};i++){ float dt = tau-uEv[i].x; float m = uEv[i].y;
    if(dt>0. && m>0.){ cx += uEv[i].z*m*2.6*(1.-exp(-dt*5.))*(.4+.6*exp(-dt*.22));
      float s = m*exp(-dt*.55); sh += s; hs += s*1.5*(1.-exp(-dt*9.)); } }
}
float lvl(float l, float tau, float side){ return 3.6*pow(l/NL,1.3)*(.85+.15*sin(tau*.55+side*1.9+l*.3)); }
float evap(float u, float sh){ return clamp(sh,0.,1.)*exp(-u*3.2); }
`;

export const FS_POINT = /* glsl */ `varying vec3 vC; varying float vA; varying float vS;
void main(){ float r = length(gl_PointCoord-.5)*2.; float a = smoothstep(1., vS, r)*vA; if(a<.004) discard; gl_FragColor = vec4(vC, a); }`;

/**
 * Copy mask (copy.ts): 1 away from the page copy, uTextDim inside a copy box
 * (device px, GL origin bottom-left), a smooth ramp across uTextF. Nodes,
 * wires and lines multiply their alpha by it; the point clouds do not.
 */
export const COPY_MASK = /* glsl */ `
uniform vec4 uTextR[${MAX_COPY}]; uniform float uTextN, uTextF, uTextDim;
float textMask(){ float m = 1.; vec2 p = gl_FragCoord.xy;
  for(int i=0;i<${MAX_COPY};i++){ if(float(i)>=uTextN) break; vec4 r = uTextR[i];
    vec2 d = max(r.xy-p, p-r.zw); m = min(m, mix(uTextDim, 1., smoothstep(0., uTextF, max(d.x, d.y)))); }
  return m; }
`;

export const FS_LINE = /* glsl */ `varying vec3 vC; varying float vA; ${COPY_MASK} void main(){ gl_FragColor = vec4(vC, vA*textMask()); }`;

/** FS_POINT for points that draw a line (the price thread's bead chain): dims behind copy like the lines. */
export const FS_POINT_LINE = /* glsl */ `varying vec3 vC; varying float vA; varying float vS; ${COPY_MASK}
void main(){ float r = length(gl_PointCoord-.5)*2.; float a = smoothstep(1., vS, r)*vA*textMask(); if(a<.004) discard; gl_FragColor = vec4(vC, a); }`;

/** Depth of field: circle of confusion from distance to the focus plane. */
export const DOF = /* glsl */ `float d = -mv.z; float coc = clamp(abs(d-uFocus)/uFocus*uAp, 0., 1.);`;

/* ───────────── background: horizon light, tinted by regime ───────────── */

export const BG_VS = /* glsl */ `varying vec2 v; void main(){ v = position.xy; gl_Position = vec4(position.xy, 1., 1.); }`;

export const BG_FS = /* glsl */ `varying vec2 v; uniform float uHor, uHeat, uAspect;
  void main(){ float dy = v.y-uHor; float band = exp(-dy*dy*(dy>0.?9.:26.));
    float core = exp(-dy*dy*240.)*exp(-v.x*v.x*1.6);
    vec3 cold = vec3(.078,.102,.141), hot = vec3(.16,.066,.024);
    vec3 c = vec3(.0196,.0235,.0314) + mix(cold,hot,uHeat)*band*(.55+.45*exp(-v.x*v.x*1.2)) + mix(vec3(.10,.13,.17),vec3(.34,.15,.04),uHeat)*core;
    gl_FragColor = vec4(c,1.); }`;

/* ───────────── terrain: one point per (price level column × tick row × run copy) ───────────── */

export const TERRAIN_VS =
  GLSL_MARKET +
  /* glsl */ `
    attribute float aU, aSide, aRow, aRnd, aCopy, aFill; uniform vec3 uBid, uAsk, uGrey, uShock, uBone;
    varying vec3 vC; varying float vA; varying float vS;
    void main(){
      float age = aFill>.5 ? 0. : fract(aRow + uT/uSpan);
      float tau = uT - age*uSpan; float cx, hs, sh; market(tau, cx, hs, sh);
      float l = floor(aU*NL), fr = fract(aU*NL);
      bool riser = fr<.2 && aFill<.5;
      float uu = riser ? l/NL : aU;
      float h0 = lvl(l,tau,aSide), h1 = lvl(l+1.,tau,aSide);
      float y = riser ? mix(h0,h1,aRnd) : h1;
      if(aFill>.5) y = h1*aRnd;
      float e = evap(uu, sh);
      y *= 1.-.82*e;
      float lift = e*step(.55,aRnd)*aRnd*3.4;
      vec3 p = vec3(cx + aSide*(hs+uu*uW) + lift*aSide*.25, y + lift, -age*uLen - (aCopy-2.)*uSplit*4.2);
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
      ${DOF}
      float near = exp(-aU*2.6);
      vec3 c = mix(uGrey, aSide>0. ? uAsk : uBid, .16+.84*near);
      c = mix(c, uShock, clamp(sh*1.3,0.,1.)*(.5+.4*near));
      if(riser) c *= .7;
      float fade = pow(1.-age,1.9)*step(age,uExtent)*smoothstep(0.,.004,age+aFill);
      float a = (aFill>.5 ? .4*uFace : .8*uHist)*fade*uDim*(1.-.5*e);

      float sz = uPx*.036*(.65+.7*aRnd)/d;
      a *= min(1., sz/(1.3*uDpr)); a /= (1.+coc*coc*30.);
      gl_PointSize = max(sz, 1.3*uDpr) + coc*14.*uDpr;
      vC = c; vA = a; vS = mix(.35, .0, coc);
    }`;

/* ───────────── slices: the "now" face silhouette + one rib per second of history ───────────── */

export const SLICE_VS =
  GLSL_MARKET +
  /* glsl */ `
  attribute float aK, aUL, aHL, aSide; uniform float uNow, uCopy, uAlpha; uniform vec3 uBid, uAsk, uBone, uShock;
  varying vec3 vC; varying float vA;
  void main(){
    float age = uNow>.5 ? 0. : (fract(uT)+aK)/uSpan; float tau = uT-age*uSpan;
    float cx, hs, sh; market(tau, cx, hs, sh);
    float u = aUL/NL; float h = aHL<.5 ? 0. : lvl(aHL,tau,aSide); h *= 1.-.82*evap(u,sh);
    vec3 p = vec3(cx+aSide*(hs+u*uW), h, -age*uLen-(uCopy-2.)*uSplit*4.2);
    gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
    vC = mix(mix(uBone, aSide>0. ? uAsk : uBid, uNow>.5 ? .75 : .35), uShock, clamp(sh,0.,1.)*.6);
    vA = uAlpha*pow(1.-age,1.6)*step(age,uExtent)*(uNow>.5 ? max(uDim,.6) : uDim*uHist*(1.-uSplit));
  }`;

/* ───────────── price thread + best bid / best ask along the floor ───────────── */

export const threadVS = (points: boolean): string =>
  GLSL_MARKET +
  /* glsl */ `
    attribute float aAge; uniform float uOff, uCopy, uAlpha; uniform vec3 uCol, uShock; varying vec3 vC; varying float vA; varying float vS;
    void main(){ float tau = uT-aAge*uSpan; float cx, hs, sh; market(tau, cx, hs, sh);
      vec3 p = vec3(cx+uOff*hs, .02, -aAge*uLen-(uCopy-2.)*uSplit*4.2);
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
      vC = mix(uCol, uShock, clamp(sh,0.,1.)*.7); vA = uAlpha*pow(1.-aAge,1.2)*step(aAge,uExtent)*min(uDim,1.)*mix(1.,min(uHist,1.),smoothstep(0.,.06,aAge)); vS = .2;
      ${points ? "gl_PointSize = max(uPx*.05/(-mv.z), 1.6*uDpr);" : ""} }`;

/* ───────────── floor grid: fixed price lines running into the past ───────────── */

export const FLOOR_VS = /* glsl */ `attribute float aAge; uniform float uExtent, uDim, uSplit; varying vec3 vC; varying float vA;
    void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); vC = vec3(.93,.92,.89); vA = .075*pow(1.-aAge,1.4)*uExtent*(1.-uSplit); }`;

/* ───────────── orders in flight: agent → resting place on the "now" face ───────────── */

export const ORDERS_VS =
  GLSL_MARKET +
  /* glsl */ `
    attribute float aAgent, aSide, aU, aPhase, aSpeed, aTrail; uniform vec3 uAgentPos[6]; uniform float uArb, uArbSide, uOrders, uScore; uniform vec3 uBid, uAsk, uPool;
    varying vec3 vC; varying float vA; varying float vS;
    void main(){
      float s = fract(aPhase+uT*aSpeed) - aTrail*.016; float vis = step(0., s);
      vec3 A = uAgentPos[0]; for(int i=1;i<6;i++){ if(aAgent>float(i)-.5) A = uAgentPos[i]; }
      bool arb = aAgent>4.5; float side = arb ? uArbSide : aSide; float u = arb ? 0. : aU;
      float cx, hs, sh; market(uT, cx, hs, sh);
      float h = arb ? .1 : lvl(floor(u*NL)+1., uT, side)*(1.-.82*evap(u,sh));
      vec3 B = vec3(cx+side*(hs+u*uW), h, 0.);
      vec3 Cc = mix(A,B,.5)+vec3(0., arb ? 2.2 : 1.3, arb ? 1.5 : .7);
      vec3 p = mix(mix(A,Cc,s), mix(Cc,B,s), s);
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
      ${DOF}
      vC = arb ? uPool : (side>0. ? uAsk : uBid);
      float hit = smoothstep(.9,1.,s)*(1.-aTrail*.5);
      vA = vis*smoothstep(0.,.12,s)*(1.-aTrail*.3)*(arb ? uArb : uOrders*(1.-uScore))*(.55+hit*.9)*uExtent/(1.+coc*coc*10.);
      gl_PointSize = max(uPx*(.055+hit*.07)/d, 1.6*uDpr)+coc*8.*uDpr; vS = .1;
    }`;

/* ───────────── on-chain pool: the curve x·y=k as a ribbon of points ───────────── */

export const POOL_VS = /* glsl */ `uniform float uPx, uDpr, uFocus, uAp, uExtent, uBeadR, uPoolA; uniform vec3 uPool, uBone; attribute float aR, aRnd;
    varying vec3 vC; varying float vA; varying float vS;
    void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; ${DOF}
      float near = exp(-abs(aR-uBeadR)*5.); vC = mix(uPool, uBone, near*.7);
      vA = (.3+near*.7)*min(uPoolA,1.6)*uExtent/(1.+coc*coc*20.);
      float sz = uPx*.034*(.7+.6*aRnd)/d; vA *= min(1., sz/(1.3*uDpr)); gl_PointSize = max(sz,1.3*uDpr)+coc*12.*uDpr; vS = mix(.3,0.,coc); }`;

export const POOL_AXIS_VS = /* glsl */ `uniform float uPoolA, uExtent; varying vec3 vC; varying float vA; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); vC = vec3(.42,.61,1.); vA = .4*min(uPoolA,1.)*uExtent; }`;

/* ───────────── agent nodes (+ pool bead + the visitor's order slug) ───────────── */

export const NODE_VS = /* glsl */ `uniform float uPx, uDpr, uExtent; attribute float aKind, aPulse, aLife; varying float vK, vP, vL;
    void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; vK = aKind; vP = aPulse; vL = aLife*uExtent;
      gl_PointSize = clamp(uPx*(aKind>2.5 ? .4 : .62)*(1.+aPulse*.35)/(-mv.z), 12.*uDpr, 72.*uDpr); }`;

export const NODE_FS = /* glsl */ `uniform vec3 uBone, uPool, uAsk, uBid, uShock; varying float vK, vP, vL; ${COPY_MASK}
    void main(){ float r = length(gl_PointCoord-.5)*2.; if(r>1.) discard;
      vec3 c = vK>2.5 ? uBid : vK>1.5 ? uPool : uBone; if(vL<0.) c = uAsk;
      float core = smoothstep(.24,.15,r);
      float ring = vK>.5 && vK<1.5 ? smoothstep(.06,.0,abs(r-.6))*(.5+vP) : 0.;
      float ring2 = smoothstep(.04,.0,abs(r-(.3+vP*.6)))*vP;
      float halo = exp(-r*r*6.)*.22*(1.+vP*1.5);
      float a = (core+ring+ring2+halo)*abs(vL)*smoothstep(1.,.85,r)*textMask();
      gl_FragColor = vec4(c, a); }`;

/* ───────────── gate (docs/design/landing/gate.html): the boot sequence variant ───────────── */

export const GATE_MARKET = /* glsl */ `uniform float uT, uSpan, uLen, uW, uPx, uDpr, uFocus, uAp, uExtent, uRise; const float NL = ${NL}.;
float midBase(float t){ return .9*sin(t*.13)+.5*sin(t*.31+1.3)+.22*sin(t*.83+.7)+.07*sin(t*2.1+2.); }
float lvl(float l, float tau, float side){ return 3.6*pow(l/NL,1.3)*(.85+.15*sin(tau*.55+side*1.9+l*.3)); }
float rise(float l){ return smoothstep(0., 1., clamp(uRise*(NL+2.)-l, 0., 1.)); }`;

export const GATE_BG_FS = /* glsl */ `varying vec2 v; uniform float uHor, uOn; void main(){ float dy = v.y-uHor; float band = exp(-dy*dy*(dy>0.?9.:26.)); float core = exp(-dy*dy*240.)*exp(-v.x*v.x*1.6);
      vec3 c = vec3(.0196,.0235,.0314) + uOn*(vec3(.078,.102,.141)*band*(.55+.45*exp(-v.x*v.x*1.2)) + vec3(.10,.13,.17)*core); gl_FragColor = vec4(c,1.); }`;

export const GATE_TERRAIN_VS =
  GATE_MARKET +
  /* glsl */ `attribute float aU, aSide, aRow, aRnd, aFill; uniform vec3 uBid, uAsk, uGrey; varying vec3 vC; varying float vA; varying float vS;
      void main(){ float age = aFill>.5 ? 0. : fract(aRow+uT/uSpan); float tau = uT-age*uSpan; float cx = midBase(tau);
        float l = floor(aU*NL), fr = fract(aU*NL); bool riser = fr<.2 && aFill<.5; float uu = riser ? l/NL : aU;
        float h0 = lvl(l,tau,aSide)*rise(l), h1 = lvl(l+1.,tau,aSide)*rise(l); float y = riser ? mix(h0,h1,aRnd) : h1; if(aFill>.5) y = h1*aRnd;
        vec4 mv = modelViewMatrix*vec4(cx+aSide*(.16+uu*uW), y, -age*uLen, 1.); gl_Position = projectionMatrix*mv;
        float d = -mv.z; float coc = clamp(abs(d-uFocus)/uFocus*uAp,0.,1.); float near = exp(-aU*2.6);
        vec3 c = mix(uGrey, aSide>0. ? uAsk : uBid, .16+.84*near); if(riser) c *= .7;
        float a = (aFill>.5 ? .4 : .8)*pow(1.-age,1.9)*step(age,uExtent)*smoothstep(0.,.004,age+aFill)*rise(l);
        float sz = uPx*.036*(.65+.7*aRnd)/d; a *= min(1., sz/(1.3*uDpr)); a /= (1.+coc*coc*30.);
        gl_PointSize = max(sz,1.3*uDpr)+coc*14.*uDpr; vC = c; vA = a; vS = mix(.35,0.,coc); }`;

export const GATE_FACE_VS =
  GATE_MARKET +
  /* glsl */ `attribute float aUL, aHL, aSide; uniform vec3 uBid, uAsk, uBone; varying vec3 vC; varying float vA;
      void main(){ float cx = midBase(uT); float h = aHL<.5 ? 0. : lvl(aHL,uT,aSide)*rise(aHL-1.);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(cx+aSide*(.16+aUL/NL*uW), h, 0., 1.); vC = mix(uBone, aSide>0. ? uAsk : uBid, .75); vA = rise(aUL-1.); }`;

export const GATE_THREAD_VS =
  GATE_MARKET +
  /* glsl */ `attribute float aAge; uniform vec3 uBone; varying vec3 vC; varying float vA;
      void main(){ float tau = uT-aAge*uSpan; gl_Position = projectionMatrix*modelViewMatrix*vec4(midBase(tau), .02, -aAge*uLen, 1.); vC = uBone; vA = .9*pow(1.-aAge,1.2)*step(aAge,uExtent); }`;

export const GATE_NODE_VS = /* glsl */ `uniform float uPx, uDpr, uAgents; attribute float aKind, aI; varying float vK, vL;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; vK = aKind; vL = clamp(uAgents*5.-aI, 0., 1.);
        gl_PointSize = clamp(uPx*.62*(1.+(1.-vL)*.6)/(-mv.z), 12.*uDpr, 72.*uDpr); }`;

export const GATE_NODE_FS = /* glsl */ `uniform vec3 uBone; varying float vK, vL; ${COPY_MASK} void main(){ float r = length(gl_PointCoord-.5)*2.; if(r>1.) discard;
        float a = (smoothstep(.24,.15,r) + (vK>.5 ? smoothstep(.06,0.,abs(r-.6))*.5 : 0.) + exp(-r*r*6.)*.22)*vL*smoothstep(1.,.85,r)*textMask(); gl_FragColor = vec4(uBone, a); }`;
