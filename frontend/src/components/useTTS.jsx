import { useState, useEffect } from 'react';

export default function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Ensure synth is accessed only on the client side
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const speak = (text) => {
    if (!synth) return;

    if (synth.speaking) {
      synth.cancel();
    }
    if (text !== '') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synth.speak(utterance);
    }
  };

  const cancel = () => {
    if (synth) {
      synth.cancel();
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (synth && synth.speaking) {
        synth.cancel();
      }
    };
  }, [synth]);

  return { speak, cancel, isSpeaking };
}