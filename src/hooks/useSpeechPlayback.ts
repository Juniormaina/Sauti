import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '../services/api';
import { formatTextForBrowserSpeech } from '../utils/speechPronunciation';
import { useOfflineStore } from '../stores/offlineStore';

export { formatTextForBrowserSpeech };
export type SpeechEngineMode = 'idle' | 'gemini' | 'browser_fallback';

export function useSpeechPlayback() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [engineUsed, setEngineUsed] = useState<SpeechEngineMode>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speakWithBrowser = useCallback((text: string, speed: number) => {
    setIsLoading(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(formatTextForBrowserSpeech(text));
      utterance.lang = 'en-GB';
      utterance.rate = speed;
      setEngineUsed('browser_fallback');
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setError('Browser speech synthesis could not play audio.');
      };
      window.speechSynthesis.speak(utterance);
      return 'browser_fallback' as const;
    }
    setError('Neither server TTS nor browser speech synthesis is available.');
    return 'idle' as const;
  }, []);

  const speak = useCallback(
    async (
      text: string,
      options?: { voiceName?: string; speed?: number; style?: string; forceServer?: boolean }
    ) => {
      stop();
      setError(null);
      setIsLoading(true);

      const speed = options?.speed ?? 1;
      const { isOnline, lowBandwidthMode } = useOfflineStore.getState();

      // Offline or Data-Saving Mode: use zero-data local SpeechSynthesis directly
      if (!isOnline || (lowBandwidthMode && !options?.forceServer)) {
        return speakWithBrowser(text, speed);
      }

      try {
        const result = await apiFetch<{ audioBase64: string; mimeType: string }>('/api/voice/tts', {
          method: 'POST',
          timeoutMs: 15000,
          body: JSON.stringify({
            text,
            voiceName: options?.voiceName || 'Kore',
            style: options?.style,
          }),
        });

        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
        audio.playbackRate = speed;
        audioRef.current = audio;
        setEngineUsed('gemini');
        setIsLoading(false);
        setIsSpeaking(true);

        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          setError('Unable to play generated audio.');
        };
        await audio.play();
        return 'gemini' as const;
      } catch {
        return speakWithBrowser(text, speed);
      }
    },
    [speakWithBrowser, stop]
  );

  return { speak, stop, isSpeaking, isLoading, engineUsed, error };
}
