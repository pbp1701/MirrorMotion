import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Holistic } from '@mediapipe/holistic';
import * as Kalidokit from 'kalidokit';
import Scene from './Scene.jsx';

const HOLISTIC_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137';

const App = () => {
  const videoRef = useRef(null);
  const holisticRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // High-frequency motion data is kept in a ref to avoid rerendering React every frame.
  const rigDataRef = useRef({
    pose: null,
    face: null,
    leftHand: null,
    rightHand: null,
  });

  const [status, setStatus] = useState('Initializing camera and tracker...');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const stopEverything = async () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (holisticRef.current) {
        try {
          await holisticRef.current.close();
        } catch (closeError) {
          console.warn('Holistic close warning:', closeError);
        }
        holisticRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const onResults = (results) => {
      try {
        const video = videoRef.current;
        if (!video) return;

        // Pose solver uses both 3D world landmarks and 2D landmarks for better quality.
        rigDataRef.current.pose =
          results.poseLandmarks && results.poseWorldLandmarks
            ? Kalidokit.Pose.solve(results.poseWorldLandmarks, results.poseLandmarks, {
                runtime: 'mediapipe',
                video,
              })
            : null;

        rigDataRef.current.face = results.faceLandmarks
          ? Kalidokit.Face.solve(results.faceLandmarks, {
              runtime: 'mediapipe',
              video,
            })
          : null;

        rigDataRef.current.leftHand = results.leftHandLandmarks
          ? Kalidokit.Hand.solve(results.leftHandLandmarks, 'Left')
          : null;

        rigDataRef.current.rightHand = results.rightHandLandmarks
          ? Kalidokit.Hand.solve(results.rightHandLandmarks, 'Right')
          : null;
      } catch (solveError) {
        console.error('Kalidokit solve error:', solveError);
      }
    };

    const start = async () => {
      try {
        setStatus('Requesting webcam access...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element not available.');
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await video.play();

        setStatus('Loading MediaPipe Holistic...');

        const holistic = new Holistic({
          locateFile: (file) => `${HOLISTIC_CDN}/${file}`,
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          refineFaceLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        holistic.onResults(onResults);
        holisticRef.current = holistic;

        setStatus('Tracking started. Move in front of the camera.');

        const processFrame = async () => {
          if (!isMounted || !holisticRef.current || !videoRef.current) return;

          try {
            await holisticRef.current.send({ image: videoRef.current });
          } catch (pipelineError) {
            console.error('Holistic frame processing error:', pipelineError);
          }

          rafRef.current = requestAnimationFrame(processFrame);
        };

        rafRef.current = requestAnimationFrame(processFrame);
      } catch (startError) {
        console.error('Startup error:', startError);
        setError(
          startError?.message ||
            'Failed to initialize VTuber pipeline. Please allow webcam access and refresh.',
        );
        setStatus('Initialization failed.');
      }
    };

    start();

    return () => {
      isMounted = false;
      stopEverything();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#10131a' }}>
      <Canvas camera={{ position: [0, 1.4, 2.2], fov: 35 }}>
        <Suspense fallback={null}>
          <Scene rigDataRef={rigDataRef} />
        </Suspense>
      </Canvas>

      {/* Hidden video feed powers MediaPipe tracking */}
      <video ref={videoRef} style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          color: '#fff',
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 14,
          background: 'rgba(0,0,0,0.45)',
          padding: '10px 12px',
          borderRadius: 10,
          maxWidth: 460,
          lineHeight: 1.4,
        }}
      >
        <div><strong>MirrorMotion</strong></div>
        <div>{status}</div>
        {error ? <div style={{ color: '#ff8b8b', marginTop: 6 }}>Error: {error}</div> : null}
      </div>
    </div>
  );
};

export default App;
