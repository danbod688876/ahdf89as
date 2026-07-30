"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Minimal shape of the Web Speech API this hook uses — not in lib.dom.d.ts.
interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition
  );
}

const noopSubscribe = () => () => {};

/** Hydration-safe: server always sees "unsupported", client checks once on mount. */
export function useSpeechSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => !!getSpeechRecognitionCtor(),
    () => false
  );
}

/**
 * Wraps the Web Speech API for the app's capture bars. Appends each
 * transcript onto whatever text the caller is managing rather than owning
 * the text state itself, so the same hook drops into any capture bar.
 */
export function useSpeechInput(appendTranscript: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = useSpeechSupported();

  function toggleListening() {
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      appendTranscript(event.results[0][0].transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  return { supported, isListening, toggleListening };
}
