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

  // small vertical wiggle so you can see motion (Y is up in MindAR)
  vec3 pos = position;
  pos.y += 0.1 * sin(u_time * 2.0 + pos.x * 5.0 + pos.z * 5.0);

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
    physicalWidth: 0.2794,
  });

  const { renderer, scene, camera } = mindarThree;

  const anchor = mindarThree.addAnchor(0);

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
  testPlane.rotation.x = -Math.PI / 2; // Rotate to face upward (camera looks down Y-axis)
  testPlane.position.y = 0.01; // Lift slightly above marker
  anchor.group.add(testPlane);

  // Basic material plane for comparison
  const basicMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const basicPlane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), basicMat);
  basicPlane.rotation.x = -Math.PI / 2; // Rotate to face upward
  basicPlane.position.y = 0.02; // Lift slightly more
  anchor.group.add(basicPlane);
  
  console.log('Planes added. TestPlane visible:', testPlane.visible, 'BasicPlane visible:', basicPlane.visible);

  // Debug cube
  const debugCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
  );
  debugCube.position.set(0, 3, 0); // 3 units above marker (Y is up in MindAR)
  anchor.group.add(debugCube);

  console.log("Starting MindAR...");
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
