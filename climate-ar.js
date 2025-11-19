// climate-ar.js
import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const CSV_FILE = "yearly_climate_summary.csv";

// ---- 1. Your shaders (slightly adapted for Three.js) ----

// VERTEX SHADER: based on your original, but:
// - uses Three's `position` and `uv` attributes
// - uses `projectionMatrix` and `modelViewMatrix` instead of u_proj/u_view
const vertexShader = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float u_time;
uniform float u_anomaly;     // 0..1
uniform float u_cumulative;  // 0..1
uniform float u_heightScale;
uniform float u_wind;        // 0..1
uniform float u_precip;      // 0..1

varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uv;
varying float v_anom;

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

// Simplex noise 2D for organic spatial variation
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0),
                          dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float disp(vec2 p, float t, float an, float cum, float wind, float precip){
  float A = mix(0.05, 0.25, an) + cum * 0.12;

  vec2 noiseCoord = p * 0.2;
  float n1 = snoise(noiseCoord + vec2(t*0.1, 0.0));
  float n2 = snoise(noiseCoord * 1.3 - vec2(0.0, t*0.15));

  float localPhase = (n1 + n2) * 0.5;
  float localAmp = 0.7 + 0.3 * snoise(p * 0.15 + t * 0.08);

  float k1 = mix(0.6, 0.4, an), sp1 = 0.8 + wind * 0.15;
  float k2 = mix(0.8, 0.6, an), sp2 = 1.0 + wind * 0.2;
  float k3 = mix(0.9, 0.7, an), sp3 = 0.6 + wind * 0.1;

  vec2 q1 = rot(0.00) * p;
  float w1 = sin(dot(q1, vec2(k1, k1*1.05)) - t*sp1 + localPhase*0.3);

  vec2 q2 = rot(2.09) * p;
  float w2 = sin(dot(q2, vec2(k2, k2*1.05)) - t*sp2 + localPhase*0.3);

  vec2 q3 = rot(4.19) * p;
  float w3 = sin(dot(q3, vec2(k3, k3*1.05)) - t*sp3 + localPhase*0.3);

  return A * localAmp * (w1 + 0.8*w2 + 0.6*w3);
}

void main(){
  v_uv = uv;
  v_anom = u_anomaly;

  // Our PlaneGeometry will be 17×11, so position.x ∈ [-8.5,8.5], position.y ∈ [-5.5,5.5].
  vec2 plane = vec2(position.x, position.y);

  float t = u_time;

  float billow1 = sin(plane.x * 0.3 + t * 0.4) * cos(plane.y * 0.25 + t * 0.35);
  float billow2 = sin(plane.x * 0.4 - plane.y * 0.3 + t * 0.5);
  float billowHeight = (billow1 * 0.8 + billow2 * 0.5) * 0.3;

  float h  = disp(plane, t, u_anomaly, u_cumulative, u_wind, u_precip) + billowHeight;

  float e = 0.05;
  float billow1x = sin((plane.x+e) * 0.3 + t * 0.4) * cos(plane.y * 0.25 + t * 0.35);
  float billow2x = sin((plane.x+e) * 0.4 - plane.y * 0.3 + t * 0.5);
  float billowHeightX = (billow1x * 0.8 + billow2x * 0.5) * 0.3;

  float billow1y = sin(plane.x * 0.3 + t * 0.4) * cos((plane.y+e) * 0.25 + t * 0.35);
  float billow2y = sin(plane.x * 0.4 - (plane.y+e) * 0.3 + t * 0.5);
  float billowHeightY = (billow1y * 0.8 + billow2y * 0.5) * 0.3;

  float hx = disp(plane + vec2(e,0.0), t, u_anomaly, u_cumulative, u_wind, u_precip)
           + billowHeightX;
  float hy = disp(plane + vec2(0.0,e), t, u_anomaly, u_cumulative, u_wind, u_precip)
           + billowHeightY;

  vec3 P  = vec3(plane.x, h * u_heightScale, plane.y);
  vec3 Px = vec3(plane.x+e, hx * u_heightScale, plane.y);
  vec3 Py = vec3(plane.x, hy * u_heightScale, plane.y+e);

  vec3 N = normalize(cross(Py-P, Px-P));

  v_pos = P;
  v_normal = N;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(P,1.0);
}
`;

// FRAGMENT SHADER: your original fs unchanged, except we don't use custom u_proj/u_view.
const fragmentShader = /* glsl */ `
precision highp float;

varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uv;
varying float v_anom;

uniform vec3 u_lightDir;
uniform vec3 u_camPos;
uniform float u_time;
uniform float u_cumulative;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0),
                          dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p * freq);
    freq *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = v_uv - 0.5;
  float aspect = 17.0 / 11.0;
  uv.x *= aspect;

  float an = v_anom * 2.0 - 1.0;
  float cum = u_cumulative * 2.0 - 1.0;

  float speed = mix(0.15, 0.6, clamp(u_cumulative, 0.0, 1.0));
  float t = u_time * speed;

  float h = v_pos.y;

  vec2 base = uv * mix(1.8, 2.5, 0.5 + 0.5*an);
  vec2 warp = vec2(
      snoise(base * 0.5 + vec2(0.0, t*0.3)),
      snoise(base * 0.5 + vec2(t*0.3, 1.0))
  );
  vec2 p = base + warp * 0.3;

  float f1 = fbm(p + vec2(t * 0.2, -t * 0.15));
  float field = f1 * 0.3;

  float value = h * 0.25 + field + an * 0.7 + cum * 0.3;
  value = 0.5 + 0.5 * value;
  value = clamp(value, 0.0, 1.0);

  vec3 cCold = vec3(0.05, 0.05, 0.6);
  vec3 cMid  = vec3(0.42, 0.05, 0.55);
  vec3 cHot  = vec3(1.0, 0.18, 0.1);

  vec3 baseCol;
  if (value < 0.5) {
    float tMid = smoothstep(0.0, 0.5, value);
    baseCol = mix(cCold, cMid, tMid);
  } else {
    float tHot = smoothstep(0.5, 1.0, value);
    baseCol = mix(cMid, cHot, tHot);
  }

  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightDir);
  vec3 V = normalize(u_camPos - v_pos);

  float lambert = max(dot(N,L), 0.0);

  vec3 col = baseCol * (0.7 + 0.3*lambert);

  float vignette = smoothstep(0.9, 0.1, length(uv));
  col *= mix(0.65, 1.0, vignette);

  float grain = fract(sin(dot(gl_FragCoord.xy,
                              vec2(12.9898,78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.02;

  float fresnel = pow(1.0 - abs(dot(N,V)), 2.0);
  float heightOpacity = smoothstep(-0.3, 0.3, v_pos.y);
  float densityNoise = snoise(uv * 3.0 + vec2(u_time * 0.1, 0.0));
  float density = 0.5 + 0.5 * densityNoise;

  float alpha = mix(0.4, 0.9, fresnel * 0.5 + heightOpacity * 0.3 + density * 0.2);

  gl_FragColor = vec4(col, alpha);
}
`;

// ---- 2. Main AR setup ----

const startAR = async () => {
  const container = document.querySelector("#container");

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: "./poster.mind",
    maxTrack: 1,
    physicalWidth: 0.2794, // 11 inches in meters
  });

  const { renderer, scene, camera } = mindarThree;

  // Anchor attached to your poster image
  const anchor = mindarThree.addAnchor(0);

  // Plane: 17 x 11 world units, with 240x156 segments (same as your WebGL grid)
  const geometry = new THREE.PlaneGeometry(17, 11, 240, 156);

  const uniforms = {
    u_time:        { value: 0.0 },
    u_anomaly:     { value: 0.5 },
    u_cumulative:  { value: 0.5 },
    u_heightScale: { value: 4.0 },
    u_wind:        { value: 0.5 },
    u_precip:      { value: 0.5 },
    u_lightDir:    { value: new THREE.Vector3(0.4, 0.8, 0.3) },
    u_camPos:      { value: new THREE.Vector3(0, 10, 10) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const cloth = new THREE.Mesh(geometry, material);

  // If your poster is portrait and you want the long side vertical, align as needed.
  // This makes the plane flush with the marker (facing the camera).
  cloth.rotation.z = Math.PI / 2;
  cloth.rotation.y = Math.PI; // flip to face camera
  anchor.group.add(cloth);

  // ---- CSV loading (same logic as your original) ----
  let years = [], anomaliesNorm = [], cumulativeNorm = [], windNorm = [], precipNorm = [];
  await fetch(CSV_FILE)
    .then(r => r.text())
    .then(text => {
      const lines = text.trim().split(/\r?\n/);
      const yearlyData = [];

      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(",");
        if (c.length < 5) continue;
        const year = parseInt(c[0], 10);
        const anomaly = parseFloat(c[2]);
        const wind = parseFloat(c[3]);
        const precip = parseFloat(c[4]);
        if (Number.isFinite(year) && Number.isFinite(anomaly)
            && Number.isFinite(wind) && Number.isFinite(precip)) {
          yearlyData.push({ year, anomaly, wind, precip });
        }
      }

      years = yearlyData.map(d => d.year);
      const rawAnom = yearlyData.map(d => d.anomaly);
      const rawWind = yearlyData.map(d => d.wind);
      const rawPrecip = yearlyData.map(d => d.precip);

      const aMin = Math.min(...rawAnom), aMax = Math.max(...rawAnom);
      const aSpan = (aMax - aMin) || 1;
      anomaliesNorm = rawAnom.map(a => (a - aMin) / aSpan);

      const cum = [];
      let acc = 0;
      for (const a of rawAnom) { acc += a; cum.push(acc); }
      const cMin = Math.min(...cum), cMax = Math.max(...cum);
      const cSpan = (cMax - cMin) || 1;
      cumulativeNorm = cum.map(v => (v - cMin) / cSpan);

      const wMin = Math.min(...rawWind), wMax = Math.max(...rawWind);
      const wSpan = (wMax - wMin) || 1;
      windNorm = rawWind.map(w => (w - wMin) / wSpan);

      const pMin = Math.min(...rawPrecip), pMax = Math.max(...rawPrecip);
      const pSpan = (pMax - pMin) || 1;
      precipNorm = rawPrecip.map(p => (p - pMin) / pSpan);
    });

  const SEC_PER_YEAR = 1.25;
  let yearIdx = 0;
  let blend = 0;
  let lastTime = performance.now() / 1000;
  const clock = new THREE.Clock();

  await mindarThree.start();

  renderer.setAnimationLoop(() => {
    const now = performance.now() / 1000;
    const dt = now - lastTime;
    lastTime = now;

    const lastIdx = anomaliesNorm.length - 1;
    if (yearIdx < lastIdx) {
      blend += dt / SEC_PER_YEAR;
      if (blend >= 1) {
        blend = 0;
        yearIdx++;
      }
    }

    const ia = yearIdx;
    const ib = Math.min(yearIdx + 1, lastIdx);

    const a = anomaliesNorm[ia] * (1 - blend) + anomaliesNorm[ib] * blend;
    const c = cumulativeNorm[ia] * (1 - blend) + cumulativeNorm[ib] * blend;
    const w = windNorm[ia] * (1 - blend) + windNorm[ib] * blend;
    const p = precipNorm[ia] * (1 - blend) + precipNorm[ib] * blend;

    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_anomaly.value = a;
    uniforms.u_cumulative.value = c;
    uniforms.u_wind.value = w;
    uniforms.u_precip.value = p;

    uniforms.u_camPos.value.copy(camera.position);

    renderer.render(scene, camera);
  });
};

document.querySelector("#startBtn").addEventListener("click", () => {
  startAR();
});
