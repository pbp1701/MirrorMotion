import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const VRM_MODEL_URL =
  'https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const damp = (current, target, lerpAmount) => current + (target - current) * lerpAmount;

/**
 * Scene component rendered inside React Three Fiber <Canvas>.
 * Receives solved Kalidokit rig data via rigDataRef (updated by App.jsx).
 */
const Scene = ({ rigDataRef }) => {
  const [vrm, setVrm] = useState(null);
  const [loadError, setLoadError] = useState('');

  const bonesRef = useRef({});
  const targetQuatRef = useRef(new THREE.Quaternion());
  const targetEulerRef = useRef(new THREE.Euler());

  // Reusable normalized bone names used by Kalidokit rigs.
  const boneNames = useMemo(
    () => ({
      hips: 'hips',
      spine: 'spine',
      chest: 'chest',
      upperChest: 'upperChest',
      neck: 'neck',
      head: 'head',
      leftShoulder: 'leftShoulder',
      rightShoulder: 'rightShoulder',
      leftUpperArm: 'leftUpperArm',
      rightUpperArm: 'rightUpperArm',
      leftLowerArm: 'leftLowerArm',
      rightLowerArm: 'rightLowerArm',
      leftHand: 'leftHand',
      rightHand: 'rightHand',
      leftUpperLeg: 'leftUpperLeg',
      rightUpperLeg: 'rightUpperLeg',
      leftLowerLeg: 'leftLowerLeg',
      rightLowerLeg: 'rightLowerLeg',
      leftFoot: 'leftFoot',
      rightFoot: 'rightFoot',

      // Left hand fingers
      leftThumbProximal: 'leftThumbProximal',
      leftThumbIntermediate: 'leftThumbIntermediate',
      leftThumbDistal: 'leftThumbDistal',
      leftIndexProximal: 'leftIndexProximal',
      leftIndexIntermediate: 'leftIndexIntermediate',
      leftIndexDistal: 'leftIndexDistal',
      leftMiddleProximal: 'leftMiddleProximal',
      leftMiddleIntermediate: 'leftMiddleIntermediate',
      leftMiddleDistal: 'leftMiddleDistal',
      leftRingProximal: 'leftRingProximal',
      leftRingIntermediate: 'leftRingIntermediate',
      leftRingDistal: 'leftRingDistal',
      leftLittleProximal: 'leftLittleProximal',
      leftLittleIntermediate: 'leftLittleIntermediate',
      leftLittleDistal: 'leftLittleDistal',

      // Right hand fingers
      rightThumbProximal: 'rightThumbProximal',
      rightThumbIntermediate: 'rightThumbIntermediate',
      rightThumbDistal: 'rightThumbDistal',
      rightIndexProximal: 'rightIndexProximal',
      rightIndexIntermediate: 'rightIndexIntermediate',
      rightIndexDistal: 'rightIndexDistal',
      rightMiddleProximal: 'rightMiddleProximal',
      rightMiddleIntermediate: 'rightMiddleIntermediate',
      rightMiddleDistal: 'rightMiddleDistal',
      rightRingProximal: 'rightRingProximal',
      rightRingIntermediate: 'rightRingIntermediate',
      rightRingDistal: 'rightRingDistal',
      rightLittleProximal: 'rightLittleProximal',
      rightLittleIntermediate: 'rightLittleIntermediate',
      rightLittleDistal: 'rightLittleDistal',
    }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();

    loader.crossOrigin = 'anonymous';
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      VRM_MODEL_URL,
      (gltf) => {
        if (disposed) return;

        try {
          // Optional cleanup helpers for performance.
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);

          const loadedVrm = gltf.userData.vrm;
          if (!loadedVrm) {
            throw new Error('VRM asset loaded but glTF did not include userData.vrm');
          }

          loadedVrm.scene.rotation.y = Math.PI;

          const mappedBones = {};
          Object.entries(boneNames).forEach(([key, value]) => {
            mappedBones[key] = loadedVrm.humanoid?.getNormalizedBoneNode(value) ?? null;
          });

          bonesRef.current = mappedBones;
          setVrm(loadedVrm);
          setLoadError('');
        } catch (error) {
          console.error('Failed to prepare VRM model:', error);
          setLoadError(error.message || 'Failed to prepare VRM model');
        }
      },
      undefined,
      (error) => {
        console.error('Failed to load VRM model:', error);
        setLoadError('Failed to load VRM avatar. Check model URL/network and try again.');
      },
    );

    return () => {
      disposed = true;
      setVrm((currentVrm) => {
        if (currentVrm?.scene) {
          VRMUtils.deepDispose(currentVrm.scene);
        }
        return null;
      });
    };
  }, [boneNames]);

  const rigRotation = (boneName, rotation, dampener = 1, lerpAmount = 0.3) => {
    if (!vrm || !rotation) return;

    const bone = bonesRef.current[boneName];
    if (!bone) return;

    targetEulerRef.current.set(
      rotation.x * dampener,
      rotation.y * dampener,
      rotation.z * dampener,
      'XYZ',
    );
    targetQuatRef.current.setFromEuler(targetEulerRef.current);

    // Smooth interpolation to reduce motion jitter.
    bone.quaternion.slerp(targetQuatRef.current, lerpAmount);
  };

  const rigPosition = (boneName, position, dampener = 1, lerpAmount = 0.3) => {
    if (!vrm || !position) return;

    const bone = bonesRef.current[boneName];
    if (!bone) return;

    const target = new THREE.Vector3(
      position.x * dampener,
      position.y * dampener,
      position.z * dampener,
    );

    bone.position.lerp(target, lerpAmount);
  };

  const setExpression = (keys, value, lerpAmount = 0.4) => {
    if (!vrm?.expressionManager) return;

    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach((key) => {
      const current = vrm.expressionManager.getValue(key) ?? 0;
      vrm.expressionManager.setValue(key, damp(current, value, lerpAmount));
    });
  };

  const rigFace = (face) => {
    if (!vrm || !face) return;

    rigRotation('neck', face.head, 0.7, 0.25);

    // Blink values in Kalidokit are eye-open values, so invert for VRM blink blendshapes.
    const blinkLeft = clamp(1 - face.eye.l, 0, 1);
    const blinkRight = clamp(1 - face.eye.r, 0, 1);

    setExpression(['blinkLeft', 'BlinkLeft'], blinkLeft, 0.5);
    setExpression(['blinkRight', 'BlinkRight'], blinkRight, 0.5);
    setExpression(['blink', 'Blink'], (blinkLeft + blinkRight) * 0.5, 0.5);

    // Basic lip-sync from Kalidokit mouth phoneme estimates.
    setExpression(['aa', 'A'], clamp(face.mouth.shape.A, 0, 1));
    setExpression(['ih', 'I'], clamp(face.mouth.shape.I, 0, 1));
    setExpression(['ee', 'E'], clamp(face.mouth.shape.E, 0, 1));
    setExpression(['oh', 'O'], clamp(face.mouth.shape.O, 0, 1));
    setExpression(['ou', 'U'], clamp(face.mouth.shape.U, 0, 1));

    // Eye look target from pupil offsets.
    if (vrm.lookAt?.applier?.lookAt) {
      vrm.lookAt.applier.lookAt(new THREE.Euler(face.pupil.y, face.pupil.x, 0, 'XYZ'));
    } else if (vrm.lookAt?.lookAt) {
      vrm.lookAt.lookAt(new THREE.Euler(face.pupil.y, face.pupil.x, 0, 'XYZ'));
    }
  };

  const rigPose = (pose) => {
    if (!pose) return;

    rigRotation('hips', pose.Hips?.rotation, 0.7, 0.2);
    rigPosition('hips', pose.Hips?.position, 1, 0.1);

    rigRotation('spine', pose.Spine, 0.25, 0.3);
    rigRotation('chest', pose.Chest, 0.25, 0.3);
    rigRotation('upperChest', pose.UpperChest, 0.25, 0.3);
    rigRotation('neck', pose.Neck, 0.25, 0.3);

    rigRotation('leftUpperArm', pose.LeftUpperArm, 1, 0.3);
    rigRotation('leftLowerArm', pose.LeftLowerArm, 1, 0.3);
    rigRotation('rightUpperArm', pose.RightUpperArm, 1, 0.3);
    rigRotation('rightLowerArm', pose.RightLowerArm, 1, 0.3);

    rigRotation('leftUpperLeg', pose.LeftUpperLeg, 1, 0.3);
    rigRotation('leftLowerLeg', pose.LeftLowerLeg, 1, 0.3);
    rigRotation('rightUpperLeg', pose.RightUpperLeg, 1, 0.3);
    rigRotation('rightLowerLeg', pose.RightLowerLeg, 1, 0.3);
  };

  const rigHand = (hand, side) => {
    if (!hand) return;

    const prefix = side === 'Left' ? 'left' : 'right';
    const wristKey = `${prefix}Hand`;

    rigRotation(wristKey, hand.Wrist, 1, 0.35);

    rigRotation(`${prefix}ThumbProximal`, hand.ThumbProximal, 1, 0.35);
    rigRotation(`${prefix}ThumbIntermediate`, hand.ThumbIntermediate, 1, 0.35);
    rigRotation(`${prefix}ThumbDistal`, hand.ThumbDistal, 1, 0.35);

    rigRotation(`${prefix}IndexProximal`, hand.IndexProximal, 1, 0.35);
    rigRotation(`${prefix}IndexIntermediate`, hand.IndexIntermediate, 1, 0.35);
    rigRotation(`${prefix}IndexDistal`, hand.IndexDistal, 1, 0.35);

    rigRotation(`${prefix}MiddleProximal`, hand.MiddleProximal, 1, 0.35);
    rigRotation(`${prefix}MiddleIntermediate`, hand.MiddleIntermediate, 1, 0.35);
    rigRotation(`${prefix}MiddleDistal`, hand.MiddleDistal, 1, 0.35);

    rigRotation(`${prefix}RingProximal`, hand.RingProximal, 1, 0.35);
    rigRotation(`${prefix}RingIntermediate`, hand.RingIntermediate, 1, 0.35);
    rigRotation(`${prefix}RingDistal`, hand.RingDistal, 1, 0.35);

    rigRotation(`${prefix}LittleProximal`, hand.LittleProximal, 1, 0.35);
    rigRotation(`${prefix}LittleIntermediate`, hand.LittleIntermediate, 1, 0.35);
    rigRotation(`${prefix}LittleDistal`, hand.LittleDistal, 1, 0.35);
  };

  useFrame((_, delta) => {
    if (!vrm) return;

    const rigData = rigDataRef?.current;
    if (rigData) {
      rigPose(rigData.pose);
      rigFace(rigData.face);
      rigHand(rigData.leftHand, 'Left');
      rigHand(rigData.rightHand, 'Right');
    }

    vrm.update(delta);
  });

  if (loadError) {
    console.error(loadError);
  }

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight intensity={1.2} position={[1, 2, 2]} />
      <directionalLight intensity={0.5} position={[-1, 1, -2]} />
      {vrm ? <primitive object={vrm.scene} position={[0, -1, 0]} /> : null}
    </>
  );
};

export default Scene;
