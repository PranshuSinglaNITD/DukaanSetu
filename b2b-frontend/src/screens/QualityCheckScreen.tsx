import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export default function QualityCheckScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTfReady, setIsTfReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [qualityResult, setQualityResult] = useState<string | null>(null);
  
  const cameraRef = useRef<CameraView>(null);

  // 1. Initialize TensorFlow and Camera Permissions on load
  useEffect(() => {
    async function setupRequirements() {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      // Boot up the TensorFlow engine on the phone's GPU
      await tf.ready(); 
      setIsTfReady(true);
      console.log("TensorFlow Edge Engine is Ready!");
    }
    setupRequirements();
  }, []);

  // 2. The 3-Second Hands-Free Timer UX
  const startQualityCheck = () => {
    setQualityResult(null);
    setCountdown(3);
    
    let timer = 3;
    const interval = setInterval(() => {
      timer -= 1;
      setCountdown(timer);
      
      if (timer === 0) {
        clearInterval(interval);
        setCountdown(null);
        captureAndAnalyzeImage();
      }
    }, 1000);
  };

  // 3. Capture, Resize, and Convert to Math (Tensors)
  const captureAndAnalyzeImage = async () => {
    if (!cameraRef.current) return;
    setAnalyzing(true);

    try {
      // Snap the photo
      const photo = await cameraRef.current.takePictureAsync();

      // CNN models crash if you feed them 12-Megapixel photos. 
      // We shrink it to 224x224 (Standard MobileNet size)
      const resizedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      // Convert the image file to Base64, then to a Uint8Array, then to a Tensor
      const imgB64 = await FileSystem.readAsStringAsync(resizedImage.uri, { encoding: FileSystem.EncodingType.Base64 });
      const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
      const raw = new Uint8Array(imgBuffer);
      
      // THIS is what gets fed into the model!
      const imageTensor = decodeJpeg(raw);

      /* * ---------------------------------------------------------
       * FUTURE MODEL EXECUTION GOES HERE
       * Example:
       * const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
       * const prediction = model.predict(imageTensor.expandDims(0));
       * const highestScore = prediction.argMax().dataSync()[0];
       * ---------------------------------------------------------
       */

      // Simulated processing time for the UI until the real model is plugged in
      setTimeout(() => {
        setQualityResult("Grade A - Premium Quality (94% Sound Grain)");
        setAnalyzing(false);
      }, 1500);

      // Memory Management: Always dispose of tensors to prevent RAM crashes!
      tf.dispose(imageTensor);

    } catch (error) {
      console.error("Analysis Failed:", error);
      setAnalyzing(false);
    }
  };

  if (hasPermission === null) return <View style={styles.container}><ActivityIndicator size="large" /></View>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <View style={styles.container}>
      {qualityResult ? (
        <View style={styles.resultView}>
          <Text style={styles.resultTitle}>Quality Assessment Complete</Text>
          <Text style={styles.resultText}>{qualityResult}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setQualityResult(null)}>
            <Text style={styles.buttonText}>Scan Another Batch</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CameraView style={styles.camera} facing='back' ref={cameraRef}>
          
          {/* Overlay for alignment */}
          <View style={styles.overlay}>
            <View style={styles.targetBox} />
            <Text style={styles.instructionText}>Hold grain steady inside the box</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {analyzing ? (
              <ActivityIndicator size="large" color="#00ff00" />
            ) : countdown !== null ? (
              <Text style={styles.countdownText}>{countdown}</Text>
            ) : (
              <TouchableOpacity 
                style={[styles.button, !isTfReady && styles.buttonDisabled]} 
                onPress={startQualityCheck}
                disabled={!isTfReady}
              >
                <Text style={styles.buttonText}>
                  {isTfReady ? "Start Quality Check" : "Loading AI Engine..."}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, justifyContent: 'space-between' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  targetBox: { width: 250, height: 250, borderWidth: 2, borderColor: '#00ff00', borderStyle: 'dashed', backgroundColor: 'rgba(0,255,0,0.1)' },
  instructionText: { color: '#fff', marginTop: 20, fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
  controls: { padding: 30, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  countdownText: { fontSize: 80, color: '#00ff00', fontWeight: 'bold' },
  button: { backgroundColor: '#208AEF', padding: 20, borderRadius: 10, width: '80%', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#555' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  resultView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  resultTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  resultText: { fontSize: 18, color: '#28a745', marginBottom: 30, textAlign: 'center' }
});