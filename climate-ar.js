// climate-ar.js (TEST VERSION)
import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

// Simple test shaders
const testVertexShader = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const testFragmentShader = /* glsl */ `
void main() {
  gl_FragColor = vec4(1.0, 1.0, 0.0, 0.8); // Bright yellow, 80% opacity
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

  const testMat = new THREE.ShaderMaterial({
    vertexShader: testVertexShader,
    fragmentShader: testFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const testPlane = new THREE.Mesh(geom, testMat);
  testPlane.rotation.x = -Math.PI / 2; // Rotate to face upward (camera looks down Y-axis)
  testPlane.position.y = 0.03; // Lift above the magenta plane
  anchor.group.add(testPlane);
  
  console.log('Shader plane created:', testPlane);
  console.log('Shader material:', testMat);
  
  // Check for shader errors
  renderer.info.autoReset = false;
  testMat.needsUpdate = true;

  // Basic material plane for comparison
  const basicMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const basicPlane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), basicMat);
  basicPlane.rotation.x = -Math.PI / 2; // Rotate to face upward
  basicPlane.position.y = 0.01; // Lower than shader plane
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

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
};

document.querySelector("#startBtn").addEventListener("click", () => {
  startAR().catch((e) => console.error("AR init failed:", e));
});
