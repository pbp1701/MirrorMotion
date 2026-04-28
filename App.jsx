import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import * as tf from '@tensorflow/tfjs';
import { Holistic } from '@mediapipe/holistic';
import Kalidokit from 'kalidokit';

const App = () => {
    const videoRef = useRef(null);
    const [pose, setPose] = useState(null);
    const [face, setFace] = useState(null);
    const [leftHand, setLeftHand] = useState(null);
    const [rightHand, setRightHand] = useState(null);

    useEffect(() => {
        const setupCamera = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        };

        const holistic = new Holistic({
            locateLandmarks: true,
            modelComplexity: 1
        });

        holistic.onResults(onResults);

        setupCamera();

        const detectLandmarks = async () => {
            const video = videoRef.current;
            await tf.ready();
            const sendFrame = async () => {
                if (video) {
                    await holistic.send({ image: video });
                }
                requestAnimationFrame(sendFrame);
            };
            sendFrame();
        };
        detectLandmarks();

        return () => {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        };
    }, []);

    const onResults = (results) => {
        if (results.poseLandmarks) {
            const solvedPose = Kalidokit.Pose.solve(results);
            setPose(solvedPose);
        }
        if (results.faceLandmarks) {
            const solvedFace = Kalidokit.Face.solve(results);
            setFace(solvedFace);
        }
        if (results.leftHandLandmarks) {
            const solvedLeftHand = Kalidokit.Hand.solve(results);
            setLeftHand(solvedLeftHand);
        }
        if (results.rightHandLandmarks) {
            const solvedRightHand = Kalidokit.Hand.solve(results);
            setRightHand(solvedRightHand);
        }
    };

    return (
        <Canvas>
            <video ref={videoRef} style={{ display: 'none' }} />
            <Scene pose={pose} face={face} leftHand={leftHand} rightHand={rightHand} />
        </Canvas>
    );
};

export default App;