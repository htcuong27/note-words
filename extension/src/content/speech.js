let activeUtterance = null;
let speakDelayTimer = null;

export function isContentSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

function pickLocalEnglishVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const localVoices = voices.filter((v) => v.localService === true);
  return (
    localVoices.find(
      (v) =>
        v.lang &&
        v.lang.toLowerCase().startsWith('en') &&
        /samantha|ava|allison|nicky|alex|daniel|aaron|karen/i.test(
          v.name || ''
        )
    ) ||
    localVoices.find((v) => v.lang && v.lang.toLowerCase() === 'en-us') ||
    localVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) ||
    voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-us') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) ||
    null
  );
}

function waitForVoices(timeoutMs = 280) {
  const existing = window.speechSynthesis.getVoices();
  if (existing && existing.length > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof window.speechSynthesis.removeEventListener === 'function') {
        window.speechSynthesis.removeEventListener('voiceschanged', done);
      }
      try {
        resolve(window.speechSynthesis.getVoices() || []);
      } catch {
        resolve([]);
      }
    };
    const timer = setTimeout(done, timeoutMs);
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', done, {
        once: true,
      });
    }
  });
}

export async function speakSelectedWord(text) {
  const cleaned = String(text || '').trim();
  if (!cleaned || !isContentSpeechSupported()) return;
  try {
    if (speakDelayTimer !== null) {
      clearTimeout(speakDelayTimer);
      speakDelayTimer = null;
    }

    const synth = window.speechSynthesis;
    const wasBusy = synth.speaking || synth.pending;
    if (wasBusy) {
      synth.cancel();
    }

    await waitForVoices();

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const enVoice = pickLocalEnglishVoice();
    if (enVoice) utterance.voice = enVoice;

    activeUtterance = utterance;
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
    };
    utterance.onerror = () => {
      if (activeUtterance === utterance) activeUtterance = null;
    };

    const runSpeak = () => {
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    };

    if (wasBusy) {
      speakDelayTimer = setTimeout(() => {
        speakDelayTimer = null;
        runSpeak();
      }, 60);
    } else {
      runSpeak();
    }
  } catch {
    // Ignore speech synthesis errors on restricted pages
  }
}
