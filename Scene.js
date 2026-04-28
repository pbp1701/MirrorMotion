// Scene.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMUtils } from '@pixiv/three-vrm';

let scene, camera, renderer, clock;
let model, mixer;
let humanoidBones = {};
const animationActions = {};

// Function to initialize the scene
function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    clock = new THREE.Clock();
    camera.position.set(0, 1.6, 3);
}

// Load the VRM model
async function loadModel(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    model = await VRM.from(gltf);
    scene.add(model.scene);
    bindHumanoidBones(model.humanoid);
    mixer = new THREE.AnimationMixer(model.scene);
    setupAnimations();
}

// Map VRM humanoid bones to their corresponding THREE.js bones
function bindHumanoidBones(humanoid) {
    humanoidBones = {
        head: humanoid.getBoneNode('head'),
        leftHand: humanoid.getBoneNode('leftHand'),
        rightHand: humanoid.getBoneNode('rightHand'),
        // Add more bones as necessary
    };
}

// Apply rotations for Kalidokit-solved values
function applyKalidoRotations(rotations) {
    for (const boneName in rotations) {
        if (humanoidBones[boneName]) {
            humanoidBones[boneName].rotation.set(
                THREE.MathUtils.degToRad(rotations[boneName].x),
                THREE.MathUtils.degToRad(rotations[boneName].y),
                THREE.MathUtils.degToRad(rotations[boneName].z)
            );
        }
    }
}

// Setup animation actions
function setupAnimations() {
    model.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        animationActions[clip.name] = action;
        action.play();
    });
}

// Animation loop with lerp smoothing for stable FPS
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}

// Resize the renderer on window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize and load the model when ready
initScene();
loadModel('path/to/your/model.vrm');
animate();