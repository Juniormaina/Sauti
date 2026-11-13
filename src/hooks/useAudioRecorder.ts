import { useCallback, useEffect, useRef, useState } from 'react';

export type MicPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useAudioRecorder() {
  const [permission, setPermission] = useState<MicPermissionStatus>('prompt');
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0));
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanupStreams = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevels(new Array(24).fill(0));
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
    }
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPermission('unsupported');
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission('granted');
      streamRef.current = stream;

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setAudioBlob(null);
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        setError('An error occurred while recording audio.');
        setIsRecording(false);
        cleanupStreams();
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          setError('No audio was captured. Please speak closer to the microphone and try again.');
        } else {
          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);
        }
        cleanupStreams();
      };

      // Real microphone audio-level analyser
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevels = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 24; i++) {
          const val = dataArray[i % dataArray.length] / 255;
          bars.push(Math.max(0.06, Math.min(1, val)));
        }
        setAudioLevels(bars);
        rafRef.current = window.requestAnimationFrame(updateLevels);
      };
      updateLevels();

      recorder.start(200);
      setIsRecording(true);
      setDurationSeconds(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        setDurationSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermission('denied');
        setError('Microphone permission was denied. Enable microphone access in browser settings to record.');
      } else {
        setError(err?.message || 'Unable to access microphone.');
      }
      cleanupStreams();
    }
  }, [audioUrl, cleanupStreams]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setDurationSeconds(0);
    setError(null);
  }, [audioUrl]);

  const getBase64Audio = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    if (!audioBlob) return null;
    const buffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return {
      base64: btoa(binary),
      mimeType: audioBlob.type || 'audio/webm',
    };
  }, [audioBlob]);

  return {
    permission,
    isRecording,
    durationSeconds,
    audioUrl,
    audioBlob,
    audioLevels,
    error,
    startRecording,
    stopRecording,
    resetRecording,
    getBase64Audio,
  };
}
