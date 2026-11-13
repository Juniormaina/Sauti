import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Headphones,
  Info,
  MessageSquare,
  Mic,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch, getActiveAuthToken } from '../../services/api';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { SAUTI_IMAGES } from '../../utils/environments';
import { ConversationSession, VoicePracticeSession } from '../../types/sauti';

type StudioTab = 'listen' | 'speak' | 'pronunciation' | 'live';

const LISTEN_ITEMS = [
  {
    category: 'Words',
    title: 'Warm Morning Vocabulary',
    text: 'Sunbird, basket, notebook, mango, veranda, tomorrow.',
  },
  {
    category: 'Sentences',
    title: 'Asking Politely',
    text: 'Excuse me, could you speak a little more slowly so I can follow clearly?',
  },
  {
    category: 'Conversations',
    title: 'Coffee & Project Catch-up',
    text: 'Good morning Amara! Shall we review the presentation notes before our ten o’clock meeting?',
  },
  {
    category: 'Stories',
    title: 'Evening Walk by the Acacia Trees',
    text: 'After the afternoon rain cleared, the weaver birds returned to the tall acacia branches while neighbours shared warm tea on the porch.',
  },
];

const PRONUNCIATION_TARGETS = [
  { level: 'Word', text: 'Confidence' },
  { level: 'Word', text: 'Comfortable' },
  { level: 'Sentence', text: 'Good morning, may I have two ripe mangoes please?' },
  { level: 'Sentence', text: 'From my perspective, daily speaking practice builds real clarity.' },
  { level: 'Sentence', text: 'To align on our primary objective, let us review the schedule.' },
];

const CONVERSATION_MODES = [
  'Everyday conversations',
  'Introductions',
  'Shopping',
  'Travel',
  'School conversations',
  'Workplace conversations',
  'Interviews',
  'Public speaking',
  'Free conversation practice',
];

function floatTo16BitPCMBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function VoiceStudioPage() {
  const { learnerProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<StudioTab>('listen');
  const [statusInfo, setStatusInfo] = useState<{
    geminiConfigured: boolean;
    provider: string;
  } | null>(null);

  // Listen & Learn state
  const speech = useSpeechPlayback();
  const [selectedListenIdx, setSelectedListenIdx] = useState(0);
  const [voiceName, setVoiceName] = useState(learnerProfile?.voicePreferences?.voiceName || 'Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState(
    learnerProfile?.voicePreferences?.playbackSpeed || 1
  );

  // Speak & Practise state
  const recorder = useAudioRecorder();
  const [speakTranscript, setSpeakTranscript] = useState('');
  const [speakFeedback, setSpeakFeedback] = useState('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Pronunciation Coach state
  const coachRecorder = useAudioRecorder();
  const [targetIdx, setTargetIdx] = useState(2);
  const [coachTranscriptInput, setCoachTranscriptInput] = useState('');
  const [coachResult, setCoachResult] = useState<any | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  // Live AI Conversations state
  const [convMode, setConvMode] = useState(CONVERSATION_MODES[0]);
  const [liveState, setLiveState] = useState<
    'idle' | 'connecting' | 'connected' | 'demo_mode' | 'restricted'
  >('idle');
  const [liveStatusMsg, setLiveStatusMsg] = useState<string | null>(null);
  const [transcriptList, setTranscriptList] = useState<
    { role: 'user' | 'assistant'; text: string; timestamp: string }[]
  >([]);
  const [demoInputText, setDemoInputText] = useState('');
  const [sessionSummary, setSessionSummary] = useState<{
    summary: string;
    vocabularyNotes: { term: string; explanation: string }[];
  } | null>(null);

  // History
  const [practiceHistory, setPracticeHistory] = useState<VoicePracticeSession[]>([]);
  const [convHistory, setConvHistory] = useState<ConversationSession[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const liveMicCtxRef = useRef<AudioContext | null>(null);
  const liveOutCtxRef = useRef<AudioContext | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const loadHistory = async () => {
    try {
      const data = await apiFetch<{
        practiceSessions: VoicePracticeSession[];
        conversationSessions: ConversationSession[];
      }>('/api/voice/history');
      setPracticeHistory(data.practiceSessions || []);
      setConvHistory(data.conversationSessions || []);
    } catch {
      // Ignore if unauthenticated
    }
  };

  useEffect(() => {
    apiFetch<{ geminiConfigured: boolean; provider: string }>('/api/voice/status')
      .then(setStatusInfo)
      .catch(() => {});
    loadHistory();

    return () => {
      stopLiveConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Speak & Practise handler ---
  const handleSubmitSpeakRecording = async () => {
    setTranscribeError(null);
    const audio = await recorder.getBase64Audio();
    if (!audio) return;

    setIsTranscribing(true);
    let capturedText = '';
    try {
      const tr = await apiFetch<{ transcript: string }>('/api/voice/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioBase64: audio.base64, mimeType: audio.mimeType }),
      });
      capturedText = tr.transcript;
      setSpeakTranscript(capturedText);
    } catch (err: any) {
      setTranscribeError(
        err.message ||
          'Server transcription unavailable. You can replay your audio and type notes below.'
      );
    } finally {
      setIsTranscribing(false);
    }

    const words = capturedText.split(/\s+/).filter(Boolean).length;
    const feedback =
      words > 0
        ? `Captured ${words} words over ${recorder.durationSeconds}s. Listen back to check clarity and steady pacing.`
        : `Recorded ${recorder.durationSeconds}s of voice practice. Replay your recording to listen closely to your tone.`;
    setSpeakFeedback(feedback);

    try {
      await apiFetch('/api/voice/speak-log', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'speak',
          transcript: capturedText,
          feedback,
          durationSeconds: recorder.durationSeconds,
        }),
      });
      loadHistory();
    } catch {
      // ignore logging error
    }
  };

  // --- Pronunciation Coach handler ---
  const handleRunPronunciationCoach = async () => {
    setCoachLoading(true);
    setCoachResult(null);
    const targetText = PRONUNCIATION_TARGETS[targetIdx].text;
    let spokenText = coachTranscriptInput.trim();

    if (!spokenText && coachRecorder.audioBlob) {
      try {
        const audio = await coachRecorder.getBase64Audio();
        if (audio) {
          const tr = await apiFetch<{ transcript: string }>('/api/voice/transcribe', {
            method: 'POST',
            body: JSON.stringify({ audioBase64: audio.base64, mimeType: audio.mimeType }),
          });
          spokenText = tr.transcript;
          setCoachTranscriptInput(spokenText);
        }
      } catch {
        setCoachLoading(false);
        setCoachResult({
          error:
            'Automatic server transcription is unconfigured without GEMINI_API_KEY. Replay your recording and type what you said below to run word comparison.',
        });
        return;
      }
    }

    if (!spokenText) {
      setCoachLoading(false);
      setCoachResult({ error: 'Record your voice or enter the phrase you spoke first.' });
      return;
    }

    try {
      const res = await apiFetch('/api/voice/pronunciation', {
        method: 'POST',
        body: JSON.stringify({
          targetText,
          transcript: spokenText,
          durationSeconds: coachRecorder.durationSeconds,
        }),
      });
      setCoachResult(res);
      loadHistory();
    } catch (err: any) {
      setCoachResult({ error: err.message || 'Unable to run Pronunciation Coach.' });
    } finally {
      setCoachLoading(false);
    }
  };

  // --- Live AI Conversations ---
  const play24kPcmChunk = (base64: string) => {
    if (!liveOutCtxRef.current) {
      liveOutCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = liveOutCtxRef.current;
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  };

  const stopLiveConversation = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    if (liveMicCtxRef.current) {
      liveMicCtxRef.current.close().catch(() => {});
      liveMicCtxRef.current = null;
    }
    if (liveOutCtxRef.current) {
      liveOutCtxRef.current.close().catch(() => {});
      liveOutCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  };

  const startLiveConversation = async () => {
    setLiveStatusMsg(null);
    setSessionSummary(null);
    setLiveState('connecting');

    const token = await getActiveAuthToken();
    if (!token) {
      setLiveState('demo_mode');
      setLiveStatusMsg('Sign in to connect a live voice session, or test Demo Mode below.');
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      token,
      mode: convMode,
      environment: learnerProfile?.environment || 'young_adults',
      cefrLevel: learnerProfile?.cefrLevel || 'A2',
      voiceName,
    });

    const ws = new WebSocket(`${proto}//${window.location.host}/ws/live?${params.toString()}`);
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'ready') {
        setLiveState('connected');
        setLiveStatusMsg('Connected to Gemini Live voice stream.');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          liveStreamRef.current = stream;
          const inCtx = new AudioContext({ sampleRate: 16000 });
          liveMicCtxRef.current = inCtx;
          const src = inCtx.createMediaStreamSource(stream);
          const proc = inCtx.createScriptProcessor(4096, 1, 1);
          src.connect(proc);
          proc.connect(inCtx.destination);
          proc.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const pcmB64 = floatTo16BitPCMBase64(e.inputBuffer.getChannelData(0));
              ws.send(JSON.stringify({ audio: pcmB64 }));
            }
          };
        } catch {
          setLiveStatusMsg('Microphone unavailable. You can still send text turns below.');
        }
      } else if (msg.type === 'audio' && msg.audio) {
        play24kPcmChunk(msg.audio);
      } else if (msg.type === 'input_transcript' && msg.text) {
        setTranscriptList((prev) => [
          ...prev,
          { role: 'user', text: msg.text, timestamp: new Date().toLocaleTimeString() },
        ]);
      } else if (msg.type === 'output_transcript' && msg.text) {
        setTranscriptList((prev) => [
          ...prev,
          { role: 'assistant', text: msg.text, timestamp: new Date().toLocaleTimeString() },
        ]);
      } else if (msg.type === 'demo_mode') {
        setLiveState('demo_mode');
        setLiveStatusMsg(msg.message);
        stopLiveConversation();
      } else if (msg.type === 'safety_restricted') {
        setLiveState('restricted');
        setLiveStatusMsg(msg.message);
        stopLiveConversation();
      } else if (msg.type === 'error') {
        setLiveStatusMsg(msg.message);
        setLiveState('demo_mode');
        stopLiveConversation();
      }
    };

    ws.onerror = () => {
      setLiveState('demo_mode');
      setLiveStatusMsg('Unable to open Live WebSocket; switched to clearly labelled Demo Mode.');
      stopLiveConversation();
    };
  };

  const handleSendDemoOrTextTurn = () => {
    if (!demoInputText.trim()) return;
    const text = demoInputText.trim();
    setDemoInputText('');

    if (liveState === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
      setTranscriptList((prev) => [
        ...prev,
        { role: 'user', text, timestamp: new Date().toLocaleTimeString() },
      ]);
      return;
    }

    // Clearly labelled local Demo Mode response
    const demoReply = `Demo Mode (${convMode}): Thank you for sharing "${text}". Try expanding with one detail about where or when this happens.`;
    setTranscriptList((prev) => [
      ...prev,
      { role: 'user', text, timestamp: new Date().toLocaleTimeString() },
      { role: 'assistant', text: demoReply, timestamp: new Date().toLocaleTimeString() },
    ]);
    speech.speak(demoReply, { voiceName, speed: playbackSpeed });
  };

  const handleFinishAndSummarize = async () => {
    stopLiveConversation();
    const wasDemo = liveState !== 'connected';
    setLiveState('idle');
    try {
      const res = await apiFetch<{
        summary: string;
        vocabularyNotes: { term: string; explanation: string }[];
      }>('/api/voice/conversation/summary', {
        method: 'POST',
        body: JSON.stringify({
          mode: convMode,
          isDemoMode: wasDemo,
          transcript: transcriptList,
          durationSeconds: transcriptList.length * 15,
        }),
      });
      setSessionSummary(res);
      loadHistory();
    } catch (err: any) {
      setLiveStatusMsg(err.message || 'Unable to generate session summary.');
    }
  };

  const handleDeletePractice = async (id: number) => {
    try {
      await apiFetch(`/api/voice/history/${id}`, { method: 'DELETE' });
      setPracticeHistory((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* Voice Studio Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#245C45] mb-1">
            Voice Studio · {statusInfo?.provider || 'Checking voice configuration...'}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#17201C]">
            Find your voice at your own pace
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-[#FDF3E3] border border-[#245C45]/12">
          {[
            { id: 'listen', label: 'Listen & Learn', icon: Headphones },
            { id: 'speak', label: 'Speak & Practise', icon: Mic },
            { id: 'pronunciation', label: 'Pronunciation Coach', icon: Sparkles },
            { id: 'live', label: 'Live Conversations', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as StudioTab)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#245C45] text-[#FFF8ED]'
                    : 'text-[#4A5851] hover:text-[#17201C]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB A: LISTEN & LEARN */}
      {activeTab === 'listen' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            {LISTEN_ITEMS.map((item, idx) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setSelectedListenIdx(idx)}
                className={`w-full text-left p-5 rounded-2xl border transition-colors ${
                  selectedListenIdx === idx
                    ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                    : 'bg-white border-[#245C45]/12 hover:border-[#245C45]/40'
                }`}
              >
                <p className="text-xs opacity-75 mb-1">{item.category}</p>
                <p className="font-display font-bold text-lg">{item.title}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-7 rounded-3xl bg-white border border-[#245C45]/12 p-7 flex flex-col justify-between space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#245C45] mb-2">
                {LISTEN_ITEMS[selectedListenIdx].category} · Follow along as you listen
              </p>
              <p className="font-display text-2xl sm:text-3xl font-bold leading-snug text-[#17201C] mb-6">
                &ldquo;{LISTEN_ITEMS[selectedListenIdx].text}&rdquo;
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5851] mb-1.5">
                    Voice Option
                  </label>
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full rounded-xl border border-[#245C45]/20 px-3 py-2 text-sm"
                  >
                    <option value="Kore">Kore (Warm &amp; Clear)</option>
                    <option value="Zephyr">Zephyr (Bright &amp; Friendly)</option>
                    <option value="Puck">Puck (Energetic)</option>
                    <option value="Charon">Charon (Calm &amp; Deep)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A5851] mb-1.5">
                    Playback Speed
                  </label>
                  <div className="flex gap-2">
                    {[0.75, 1, 1.25].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border tabular-nums ${
                          playbackSpeed === spd
                            ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                            : 'bg-white border-[#245C45]/15'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#245C45]/10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={speech.isLoading}
                  onClick={() =>
                    speech.speak(LISTEN_ITEMS[selectedListenIdx].text, {
                      voiceName,
                      speed: playbackSpeed,
                    })
                  }
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold text-sm hover:bg-[#194231]"
                >
                  {speech.isSpeaking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>
                    {speech.isLoading
                      ? 'Preparing audio...'
                      : speech.isSpeaking
                      ? 'Playing'
                      : 'Play audio'}
                  </span>
                </button>
                {speech.isSpeaking && (
                  <button
                    type="button"
                    onClick={speech.stop}
                    className="px-4 py-3 rounded-xl border border-[#245C45]/20 text-sm font-semibold"
                  >
                    Stop
                  </button>
                )}
              </div>

              {speech.engineUsed !== 'idle' && (
                <span className="text-xs text-[#4A5851]">
                  {speech.engineUsed === 'gemini'
                    ? 'Engine: Gemini TTS'
                    : 'Engine: Browser SpeechSynthesis fallback'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB B: SPEAK & PRACTISE */}
      {activeTab === 'speak' && (
        <div className="rounded-3xl bg-white border border-[#245C45]/12 p-7 sm:p-9 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">Speak &amp; Practise</h2>
              <p className="text-sm text-[#4A5851]">
                Introduce your day, describe a scene, or practise an upcoming conversation aloud.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#FDF3E3] text-[#245C45] tabular-nums">
              Mic status: {recorder.permission}
            </span>
          </div>

          {recorder.error && (
            <div className="rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-4 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 text-[#B43C25] shrink-0" />
              <span>{recorder.error}</span>
            </div>
          )}

          {/* Genuine audio-level visualizer */}
          <div className="rounded-2xl bg-[#FDF3E3] border border-[#245C45]/10 p-6 flex flex-col items-center space-y-5">
            <div className="w-full max-w-md h-16 flex items-end justify-center gap-1.5">
              {recorder.audioLevels.map((lvl, idx) => (
                <div
                  key={idx}
                  className={`w-2 rounded-full transition-transform ${
                    recorder.isRecording ? 'bg-[#245C45]' : 'bg-[#245C45]/20'
                  }`}
                  style={{
                    height: recorder.isRecording ? `${Math.max(10, Math.round(lvl * 100))}%` : '14%',
                  }}
                />
              ))}
            </div>

            <p className="font-mono text-2xl font-semibold text-[#17201C] tabular-nums">
              {String(Math.floor(recorder.durationSeconds / 60)).padStart(2, '0')}:
              {String(recorder.durationSeconds % 60).padStart(2, '0')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!recorder.isRecording ? (
                <button
                  type="button"
                  onClick={recorder.startRecording}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#F28B75] text-[#17201C] font-semibold text-sm hover:bg-[#f59c89]"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={recorder.stopRecording}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#17201C] text-[#FFF8ED] font-semibold text-sm"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop recording</span>
                </button>
              )}

              {recorder.audioUrl && (
                <>
                  <button
                    type="button"
                    onClick={recorder.resetRecording}
                    className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl border border-[#245C45]/20 text-sm font-semibold"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Record again</span>
                  </button>
                  <button
                    type="button"
                    disabled={isTranscribing}
                    onClick={handleSubmitSpeakRecording}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
                  >
                    <span>{isTranscribing ? 'Transcribing...' : 'Submit & transcribe'}</span>
                  </button>
                </>
              )}
            </div>

            {recorder.audioUrl && (
              <div className="w-full max-w-md pt-2">
                <p className="text-xs font-semibold text-[#4A5851] mb-1.5">Replay your recording</p>
                <audio controls src={recorder.audioUrl} className="w-full" />
              </div>
            )}
          </div>

          {transcribeError && (
            <div className="rounded-xl bg-[#F6C96B]/25 border border-[#F6C96B] p-4 text-sm text-[#17201C]">
              {transcribeError}
            </div>
          )}

          {(speakTranscript || speakFeedback) && (
            <div className="rounded-2xl bg-[#245C45]/8 border border-[#245C45]/20 p-5 space-y-2">
              {speakTranscript && (
                <div>
                  <p className="text-xs font-semibold text-[#245C45]">Transcript</p>
                  <p className="text-base font-medium">&ldquo;{speakTranscript}&rdquo;</p>
                </div>
              )}
              {speakFeedback && <p className="text-sm text-[#4A5851]">{speakFeedback}</p>}
            </div>
          )}
        </div>
      )}

      {/* TAB C: PRONUNCIATION COACH */}
      {activeTab === 'pronunciation' && (
        <div className="rounded-3xl bg-white border border-[#245C45]/12 p-7 sm:p-9 space-y-6">
          <div className="flex flex-wrap gap-2">
            {PRONUNCIATION_TARGETS.map((t, idx) => (
              <button
                key={t.text}
                type="button"
                onClick={() => {
                  setTargetIdx(idx);
                  setCoachResult(null);
                  setCoachTranscriptInput('');
                  coachRecorder.resetRecording();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  targetIdx === idx
                    ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                    : 'bg-[#FFF8ED]/60 border-[#245C45]/15'
                }`}
              >
                {t.level}: {t.text.slice(0, 28)}
                {t.text.length > 28 ? '…' : ''}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-[#FDF3E3] p-6 space-y-4">
            <p className="text-xs font-semibold text-[#245C45]">
              Target {PRONUNCIATION_TARGETS[targetIdx].level}
            </p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-[#17201C]">
              &ldquo;{PRONUNCIATION_TARGETS[targetIdx].text}&rdquo;
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  speech.speak(PRONUNCIATION_TARGETS[targetIdx].text, { voiceName, speed: 0.9 })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#245C45]/20 text-sm font-semibold text-[#245C45]"
              >
                <Volume2 className="w-4 h-4" />
                <span>Hear reference</span>
              </button>

              {!coachRecorder.isRecording ? (
                <button
                  type="button"
                  onClick={coachRecorder.startRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F28B75] text-[#17201C] text-sm font-semibold"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record yourself</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={coachRecorder.stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17201C] text-[#FFF8ED] text-sm font-semibold"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop ({coachRecorder.durationSeconds}s)</span>
                </button>
              )}
            </div>

            {coachRecorder.audioUrl && (
              <audio controls src={coachRecorder.audioUrl} className="w-full max-w-md" />
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#4A5851]">
              Spoken transcript (auto-filled when Gemini transcription is configured, or enter manually to test word comparison)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={coachTranscriptInput}
                onChange={(e) => setCoachTranscriptInput(e.target.value)}
                placeholder="Type or record to transcribe..."
                className="flex-1 rounded-xl border border-[#245C45]/20 px-4 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={coachLoading}
                onClick={handleRunPronunciationCoach}
                className="px-6 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold whitespace-nowrap"
              >
                {coachLoading ? 'Comparing...' : 'Compare & coach'}
              </button>
            </div>
          </div>

          {coachResult?.error && (
            <div className="rounded-xl bg-[#F6C96B]/25 border border-[#F6C96B] p-4 text-sm">
              {coachResult.error}
            </div>
          )}

          {coachResult && !coachResult.error && (
            <div className="rounded-2xl border border-[#245C45]/15 p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(coachResult.comparison || []).map((item: any, i: number) => (
                  <span
                    key={`${item.word}-${i}`}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold border ${
                      item.status === 'matched'
                        ? 'bg-[#245C45]/10 border-[#245C45]/30 text-[#245C45]'
                        : item.status === 'substituted'
                        ? 'bg-[#F6C96B]/30 border-[#F6C96B] text-[#17201C]'
                        : 'bg-[#F28B75]/20 border-[#F28B75] text-[#B43C25]'
                    }`}
                  >
                    {item.word} ({item.status})
                  </span>
                ))}
              </div>
              <p className="text-sm text-[#17201C] leading-relaxed">{coachResult.guidance}</p>
              <p className="text-xs text-[#4A5851] flex items-start gap-2 pt-2 border-t border-[#245C45]/10">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{coachResult.phoneticDisclaimer}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB D: LIVE AI CONVERSATIONS */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-3xl bg-white border border-[#245C45]/12 p-6 space-y-5">
            <div className="flex items-center gap-4">
              <ResilientImage
                src={SAUTI_IMAGES.voiceCompanion}
                alt="SAUTI AI Voice Companion"
                className="w-16 h-16 rounded-2xl object-cover shrink-0"
              />
              <div>
                <h2 className="font-display text-lg font-bold">SAUTI Companion</h2>
                <p className="text-xs text-[#4A5851]">
                  {liveState === 'connected'
                    ? 'Live Gemini Audio Active'
                    : liveState === 'connecting'
                    ? 'Connecting...'
                    : liveState === 'demo_mode'
                    ? 'Demo Mode (Local Speech)'
                    : liveState === 'restricted'
                    ? 'Child Safety Restriction'
                    : 'Ready to converse'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Conversation Mode
              </label>
              <select
                value={convMode}
                onChange={(e) => setConvMode(e.target.value)}
                disabled={liveState === 'connected'}
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              >
                {CONVERSATION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              {liveState !== 'connected' ? (
                <button
                  type="button"
                  onClick={startLiveConversation}
                  className="w-full py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold text-sm hover:bg-[#194231]"
                >
                  Start live voice session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishAndSummarize}
                  className="w-full py-3 rounded-xl bg-[#B43C25] text-white font-semibold text-sm"
                >
                  Stop &amp; summarize session
                </button>
              )}

              {transcriptList.length > 0 && liveState !== 'connected' && (
                <button
                  type="button"
                  onClick={handleFinishAndSummarize}
                  className="w-full py-2.5 rounded-xl border border-[#245C45]/25 text-[#245C45] font-semibold text-xs"
                >
                  Generate end-of-session summary
                </button>
              )}
            </div>

            {(learnerProfile?.environment === 'little_voices' ||
              learnerProfile?.environment === 'young_explorers') && (
              <div className="rounded-xl bg-[#FFF1E6] p-3.5 text-xs text-[#17201C] flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-[#245C45] shrink-0 mt-0.5" />
                <span>
                  Child-safe guardrails active: conversations stay guided around age-appropriate
                  learning topics.
                </span>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 rounded-3xl bg-white border border-[#245C45]/12 p-6 flex flex-col justify-between min-h-[420px] space-y-4">
            {liveStatusMsg && (
              <div className="rounded-xl bg-[#FDF3E3] border border-[#245C45]/15 px-4 py-3 text-xs text-[#17201C]">
                {liveStatusMsg}
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1">
              {transcriptList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#4A5851]">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm max-w-sm">
                    Start a live Gemini voice conversation or try a practice turn below. Your
                    transcript and vocabulary notes appear here.
                  </p>
                </div>
              ) : (
                transcriptList.map((item, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 text-sm max-w-[85%] ${
                      item.role === 'user'
                        ? 'ml-auto bg-[#245C45] text-[#FFF8ED]'
                        : 'bg-[#FDF3E3] text-[#17201C]'
                    }`}
                  >
                    <p className="text-[11px] opacity-70 mb-1">
                      {item.role === 'user' ? 'You' : 'SAUTI'} · {item.timestamp}
                    </p>
                    <p>{item.text}</p>
                  </div>
                ))
              )}
            </div>

            {sessionSummary && (
              <div className="rounded-2xl bg-[#A9D9E8]/25 border border-[#245C45]/15 p-4 space-y-2">
                <p className="font-display font-bold text-sm text-[#245C45]">
                  Session Summary
                </p>
                <p className="text-sm text-[#17201C]">{sessionSummary.summary}</p>
                {sessionSummary.vocabularyNotes?.length > 0 && (
                  <ul className="text-xs text-[#4A5851] space-y-1 pt-1">
                    {sessionSummary.vocabularyNotes.map((v) => (
                      <li key={v.term}>
                        <strong>{v.term}:</strong> {v.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[#245C45]/10">
              <input
                type="text"
                value={demoInputText}
                onChange={(e) => setDemoInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendDemoOrTextTurn()}
                placeholder={
                  liveState === 'connected'
                    ? 'Send a text note into the live session...'
                    : 'Demo Mode: type a sentence to hear SAUTI respond...'
                }
                className="flex-1 rounded-xl border border-[#245C45]/20 px-4 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={handleSendDemoOrTextTurn}
                className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Practice & Conversation History */}
      <div className="rounded-3xl bg-white border border-[#245C45]/12 p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Recent Voice Practice History</h2>
          <span className="text-xs text-[#4A5851]">
            Raw audio is never stored permanently
          </span>
        </div>

        {practiceHistory.length === 0 && convHistory.length === 0 ? (
          <p className="text-sm text-[#4A5851]">
            Complete a recording, Pronunciation Coach check, or conversation to see your history.
          </p>
        ) : (
          <div className="divide-y divide-[#245C45]/10">
            {practiceHistory.map((item) => (
              <div key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#245C45]">
                    {item.mode} · {item.durationSeconds}s ·{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  {item.targetText && (
                    <p className="text-xs text-[#4A5851] mt-0.5">Target: {item.targetText}</p>
                  )}
                  {item.transcript && (
                    <p className="text-sm font-medium text-[#17201C] mt-0.5">
                      &ldquo;{item.transcript}&rdquo;
                    </p>
                  )}
                  {item.feedback && <p className="text-xs text-[#4A5851] mt-1">{item.feedback}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePractice(item.id)}
                  aria-label="Delete voice practice record"
                  className="p-2 rounded-lg text-[#4A5851] hover:text-[#B43C25] hover:bg-[#F28B75]/15"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
