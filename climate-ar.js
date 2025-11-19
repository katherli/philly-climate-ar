// climate-ar.js (TEST VERSION)
import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

// Simple test shaders
const testVertexShader = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float u_time;

varying vec2 v_uv;

void main() {
  v_uv = uv;

  // small vertical wiggle so you can see motion
  vec3 pos = position;
  pos.z += 0.1 * sin(u_time * 2.0 + pos.x * 5.0 + pos.y * 5.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const testFragmentShader = /* glsl */ `
precision mediump float;

varying vec2 v_uv;

void main() {
  // simple UV-based gradient, slightly transparent
  vec3 color = vec3(v_uv.x, v_uv.y, 1.0);
  gl_FragColor = vec4(color, 0.7);
}
`;

const startAR = async () => {
  const container = document.querySelector("#container");
  console.log("Starting AR...");

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: "./poster.mind",
    maxTrack: 1,
    physicalWidth: 0.2794, // 11 inches in meters
  });

  const { renderer, scene, camera } = mindarThree;

  // Add some light (for completeness, though ShaderMaterial here ignores it)
  const light = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(light);

  // Anchor for your poster
  const anchor = mindarThree.addAnchor(0);

  // Simple 11x17 plane, centered on the marker, no weird rotations
  const geom = new THREE.PlaneGeometry(11, 17, 10, 10);

  const uniforms = {
    u_time: { value: 0.0 },
  };

  const testMat = new THREE.ShaderMaterial({
    vertexShader: testVertexShader,
    fragmentShader: testFragmentShader,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const testPlane = new THREE.Mesh(geom, testMat);

  // *** KEY: don't rotate it out of the marker plane.
  // Just nudge slightly toward the camera to avoid z-fighting.
  testPlane.position.z = 0.01;

  anchor.group.add(testPlane);

  // Keep your debug cube if you like
  const debugCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
  );
  debugCube.position.set(0, 0, 3); // 3 units “above” the poster
  anchor.group.add(debugCube);

  console.log("Starting MindAR session...");
  await mindarThree.start();
  console.log("MindAR started.");

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    uniforms.u_time.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  });
};

document.querySelector("#startBtn").addEventListener("click", () => {
  startAR().catch((e) => console.error("AR init failed:", e));
});
