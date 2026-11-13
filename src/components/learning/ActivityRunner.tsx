import { useState } from 'react';
import { CheckCircle2, HelpCircle, Mic, RotateCcw, Square, Volume2, XCircle } from 'lucide-react';
import { Activity } from '../../types/sauti';
import { apiFetch } from '../../services/api';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface ActivityRunnerProps {
  activity: Activity;
  learnerId?: number;
  isKids?: boolean;
  onAttempted: (result: { isCorrect: boolean; score: number; feedback: string }) => void;
}

export function ActivityRunner({
  activity,
  learnerId,
  isKids = false,
  onAttempted,
}: ActivityRunnerProps) {
  const payload = activity.payloadJson || {};
  const { speak, isSpeaking } = useSpeechPlayback();
  const recorder = useAudioRecorder();

  const [selectedOption, setSelectedOption] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [sentenceTokens, setSentenceTokens] = useState<string[]>([]);
  const [wordPairs, setWordPairs] = useState<Record<string, string>>({});
  const [activeLeftWord, setActiveLeftWord] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    score: number;
    feedback: string;
  } | null>(null);

  const submitAnswer = async (answerValue: unknown) => {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ isCorrect: boolean; score: number; feedback: string }>(
        `/api/learning/activities/${activity.id}/attempt`,
        {
          method: 'POST',
          body: JSON.stringify({ answer: answerValue, learnerId }),
        }
      );
      setResult(res);
      onAttempted(res);
    } catch (err: any) {
      setResult({
        isCorrect: false,
        score: 0,
        feedback: err.message || 'Unable to submit answer.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTranscribeAndFill = async () => {
    const audio = await recorder.getBase64Audio();
    if (!audio) return;
    setTranscribing(true);
    try {
      const res = await apiFetch<{ transcript: string }>('/api/voice/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioBase64: audio.base64, mimeType: audio.mimeType }),
      });
      setTextInput(res.transcript);
    } catch {
      // Fallback: if Gemini transcription unavailable, prompt learner to type or review playback
      setTextInput(
        (prev) =>
          prev ||
          (payload.targetText
            ? String(payload.targetText)
            : 'Spoken audio recorded (server transcription unconfigured)')
      );
    } finally {
      setTranscribing(false);
    }
  };

  const buttonBase = isKids ? 'py-4 px-5 rounded-2xl text-base font-bold' : 'py-3 px-4 rounded-xl text-sm font-semibold';

  return (
    <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 sm:p-8 space-y-5">
      <div>
        <p className="text-xs font-mono text-[#4A5851] mb-1">
          {activity.type.replace(/_/g, ' ')} · {activity.points} pts
        </p>
        <h3 className={`font-display font-bold text-[#17201C] ${isKids ? 'text-2xl' : 'text-xl'}`}>
          {activity.prompt}
        </h3>
        <p className="text-sm text-[#4A5851] mt-1">{activity.instruction}</p>
      </div>

      {/* Audio prompt button for listening/speaking activities */}
      {(payload.audioText || payload.targetText) && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => speak(String(payload.audioText || payload.targetText))}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A9D9E8]/35 text-[#17201C] text-sm font-semibold hover:bg-[#A9D9E8]/55 transition-colors"
          >
            <Volume2 className="w-4 h-4 text-[#245C45]" />
            <span>{isSpeaking ? 'Playing audio...' : 'Listen to audio prompt'}</span>
          </button>
        </div>
      )}

      {/* Story reading passage */}
      {activity.type === 'story_comprehension' && payload.story && (
        <div className="rounded-xl bg-[#FDF3E3] p-4 border border-[#245C45]/10">
          <p className="text-sm leading-relaxed text-[#17201C] mb-2">{payload.story}</p>
          <p className="text-sm font-semibold text-[#245C45]">{payload.question}</p>
        </div>
      )}

      {/* 1. Multiple Choice / Listen & Select / Story Comprehension */}
      {(activity.type === 'multiple_choice' ||
        activity.type === 'listen_select' ||
        activity.type === 'story_comprehension') && (
        <div className="space-y-2.5">
          {(payload.options || []).map((opt: string) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedOption(opt)}
              className={`w-full text-left border transition-colors ${buttonBase} ${
                selectedOption === opt
                  ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                  : 'bg-[#FFF8ED]/50 border-[#245C45]/15 hover:border-[#245C45]'
              }`}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            disabled={!selectedOption || submitting}
            onClick={() => submitAnswer(selectedOption)}
            className="mt-2 px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Checking...' : 'Check answer'}
          </button>
        </div>
      )}

      {/* 2. Picture Recognition */}
      {activity.type === 'picture_recognition' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(payload.options || []).map((opt: { id: string; label: string; colour: string }) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedOption(opt.id)}
                className={`p-5 rounded-2xl border-2 text-center transition-transform active:scale-95 ${
                  selectedOption === opt.id
                    ? 'border-[#245C45] bg-[#245C45]/10'
                    : 'border-[#245C45]/15 bg-white hover:border-[#245C45]/50'
                }`}
              >
                <span
                  className="w-16 h-16 rounded-full mx-auto mb-3 block border border-black/10"
                  style={{ backgroundColor: opt.colour }}
                />
                <span className="font-display font-bold text-lg">{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedOption || submitting}
            onClick={() => submitAnswer(selectedOption)}
            className="px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Checking...' : 'Check picture'}
          </button>
        </div>
      )}

      {/* 3. Sentence Building */}
      {activity.type === 'sentence_building' && (
        <div className="space-y-4">
          <div className="min-h-[56px] rounded-xl bg-[#FDF3E3] border border-[#245C45]/15 p-3 flex flex-wrap gap-2">
            {sentenceTokens.length === 0 && (
              <span className="text-xs text-[#4A5851] self-center">
                Tap words below in the correct order...
              </span>
            )}
            {sentenceTokens.map((word, idx) => (
              <button
                key={`${word}-${idx}`}
                type="button"
                onClick={() => setSentenceTokens((prev) => prev.filter((_, i) => i !== idx))}
                className="px-3 py-1.5 rounded-lg bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
              >
                {word}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(payload.shuffled || payload.words || []).map((word: string, idx: number) => (
              <button
                key={`${word}-src-${idx}`}
                type="button"
                onClick={() => setSentenceTokens((prev) => [...prev, word])}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#245C45]/20 text-sm font-medium hover:border-[#245C45]"
              >
                {word}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSentenceTokens([])}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#245C45]/20 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              disabled={sentenceTokens.length === 0 || submitting}
              onClick={() => submitAnswer(sentenceTokens)}
              className="px-6 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? 'Checking...' : 'Check sentence'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Word Matching */}
      {activity.type === 'word_matching' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A5851]">1. Tap a word</p>
              {(payload.pairs || []).map((p: { left: string; right: string }) => (
                <button
                  key={p.left}
                  type="button"
                  onClick={() => setActiveLeftWord(p.left)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                    activeLeftWord === p.left
                      ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                      : wordPairs[p.left]
                      ? 'bg-[#A9D9E8]/25 border-[#245C45]/30'
                      : 'bg-white border-[#245C45]/15'
                  }`}
                >
                  {p.left} {wordPairs[p.left] ? `→ ${wordPairs[p.left]}` : ''}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A5851]">2. Tap its match</p>
              {(payload.pairs || [])
                .map((p: { right: string }) => p.right)
                .slice()
                .reverse()
                .map((rightVal: string) => (
                  <button
                    key={rightVal}
                    type="button"
                    disabled={!activeLeftWord}
                    onClick={() => {
                      if (!activeLeftWord) return;
                      setWordPairs((prev) => ({ ...prev, [activeLeftWord]: rightVal }));
                      setActiveLeftWord(null);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-xl border border-[#245C45]/15 bg-white text-sm font-medium hover:border-[#245C45] disabled:opacity-60"
                  >
                    {rightVal}
                  </button>
                ))}
            </div>
          </div>
          <button
            type="button"
            disabled={Object.keys(wordPairs).length < (payload.pairs?.length || 1) || submitting}
            onClick={() => submitAnswer(wordPairs)}
            className="px-6 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Checking...' : 'Check pairs'}
          </button>
        </div>
      )}

      {/* 5. Fill in the blanks / Spelling / Grammar correction */}
      {(activity.type === 'fill_blanks' ||
        activity.type === 'spelling' ||
        activity.type === 'grammar_correction') && (
        <div className="space-y-3">
          {payload.sentence && (
            <p className="text-base font-medium bg-[#FDF3E3] p-4 rounded-xl">{payload.sentence}</p>
          )}
          {payload.incorrectSentence && (
            <p className="text-sm bg-[#F28B75]/15 p-4 rounded-xl">
              Sentence to improve: <strong>{payload.incorrectSentence}</strong>
            </p>
          )}
          {payload.hint && (
            <p className="text-xs text-[#4A5851] flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Hint: {payload.hint}</span>
            </p>
          )}
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full rounded-xl border border-[#245C45]/20 px-4 py-3 text-sm"
          />
          <button
            type="button"
            disabled={!textInput.trim() || submitting}
            onClick={() => submitAnswer(textInput)}
            className="px-6 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Checking...' : 'Submit answer'}
          </button>
        </div>
      )}

      {/* 6. Writing / Role-play / Conversation simulation / Listen & Repeat / Read Aloud / Voice Recording */}
      {(activity.type === 'writing' ||
        activity.type === 'role_play' ||
        activity.type === 'conversation_sim' ||
        activity.type === 'listen_repeat' ||
        activity.type === 'read_aloud' ||
        activity.type === 'voice_recording') && (
        <div className="space-y-4">
          {payload.partnerPrompt && (
            <div className="rounded-xl bg-[#FDF3E3] p-4 text-sm">
              <strong>Partner asks:</strong> &ldquo;{payload.partnerPrompt}&rdquo;
            </div>
          )}

          {/* Real Mic Capture Option */}
          <div className="rounded-xl border border-[#245C45]/15 p-4 bg-[#FFF8ED]/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {!recorder.isRecording ? (
                  <button
                    type="button"
                    onClick={recorder.startRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F28B75] text-[#17201C] text-sm font-semibold hover:bg-[#f59c89]"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Record voice</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={recorder.stopRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17201C] text-[#FFF8ED] text-sm font-semibold"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop ({recorder.durationSeconds}s)</span>
                  </button>
                )}

                {recorder.audioUrl && (
                  <button
                    type="button"
                    disabled={transcribing}
                    onClick={handleTranscribeAndFill}
                    className="px-3.5 py-2 rounded-xl border border-[#245C45]/25 text-xs font-semibold text-[#245C45]"
                  >
                    {transcribing ? 'Transcribing...' : 'Transcribe recording'}
                  </button>
                )}
              </div>
              <span className="text-xs text-[#4A5851] font-mono tabular-nums">
                Mic: {recorder.permission}
              </span>
            </div>

            {recorder.isRecording && (
              <div className="flex items-end gap-1 h-8">
                {recorder.audioLevels.map((lvl, i) => (
                  <span
                    key={i}
                    className="flex-1 bg-[#245C45] rounded-full transition-transform"
                    style={{ height: `${Math.max(12, Math.round(lvl * 100))}%` }}
                  />
                ))}
              </div>
            )}

            {recorder.audioUrl && (
              <audio controls src={recorder.audioUrl} className="w-full h-9" />
            )}

            {recorder.error && <p className="text-xs text-[#B43C25]">{recorder.error}</p>}
          </div>

          <textarea
            rows={3}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Your spoken transcript or written response appears here..."
            className="w-full rounded-xl border border-[#245C45]/20 px-4 py-3 text-sm"
          />

          <button
            type="button"
            disabled={!textInput.trim() || submitting}
            onClick={() => submitAnswer(textInput)}
            className="px-6 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Evaluating...' : 'Submit response'}
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {result && (
        <div
          className={`rounded-xl p-4 border flex items-start gap-3 text-sm ${
            result.isCorrect
              ? 'bg-[#245C45]/10 border-[#245C45]/30 text-[#17201C]'
              : 'bg-[#F28B75]/15 border-[#F28B75] text-[#17201C]'
          }`}
        >
          {result.isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-[#245C45] shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-[#B43C25] shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">
              {result.isCorrect ? `Well done (+${result.score} XP)` : 'Keep practising'}
            </p>
            <p className="text-[#4A5851] mt-0.5">{result.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}
