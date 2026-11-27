/**
 * Pronunciation audio helpers for Chrome Extension Popup:
 * 1. Primary: Google Translate TTS audio (crisp, consistent volume from first play).
 * 2. Fallback: Local Web Speech API (offline / rate-limit fallback).
 */

export const LANG_LOCALE_MAP = {
  English: 'en-US',
  Japanese: 'ja-JP',
  Korean: 'ko-KR',
  French: 'fr-FR',
  German: 'de-DE',
  Spanish: 'es-ES',
  Chinese: 'zh-CN',
};

const LANG_GOOGLE_TTS_MAP = {
  English: 'en',
  Japanese: 'ja',
  Korean: 'ko',
  French: 'fr',
  German: 'de',
  Spanish: 'es',
  Chinese: 'zh-CN',
};

const GOOGLE_TTS_MAX_CHARS = 180;
const GOOGLE_TTS_START_TIMEOUT_MS = 1600;
const VOICES_WAIT_TIMEOUT_MS = 280;

let voicesListenerAttached = false;
let activeUtterance = null;
let activeAudio = null;
let audioContextRef = null;
let speakDelayTimer = null;
let startWatchdogTimer = null;
let maxDurationTimer = null;
let speakToken = 0;

function hasWebSpeech() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    (hasWebSpeech() || typeof Audio !== 'undefined')
  );
}

function getPreferredLocale(lang = 'English') {
  return LANG_LOCALE_MAP[lang] || 'en-US';
}

function getGoogleTtsLang(lang = 'English') {
  return LANG_GOOGLE_TTS_MAP[lang] || 'en';
}

function buildGoogleTtsUrl(text, lang = 'English') {
  const tl = getGoogleTtsLang(lang);
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
    tl
  )}&q=${encodeURIComponent(text)}`;
}

function ensureVoicesPrewarmed() {
  if (!hasWebSpeech()) return;
  try {
    window.speechSynthesis.getVoices();
  } catch {
    // Ignore voice prewarm errors
  }
  if (voicesListenerAttached) return;
  voicesListenerAttached = true;
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // Ignore voice refresh errors
      }
    });
  }
}

function warmUpAudioContext() {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    if (!audioContextRef) {
      audioContextRef = new AudioCtx();
    }
    if (audioContextRef.state === 'suspended') {
      audioContextRef.resume().catch(() => {});
    }
  } catch {
    // Ignore AudioContext errors
  }
}

function waitForVoices(timeoutMs = VOICES_WAIT_TIMEOUT_MS) {
  if (!hasWebSpeech()) return Promise.resolve([]);
  ensureVoicesPrewarmed();
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
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      }
      try {
        resolve(window.speechSynthesis.getVoices() || []);
      } catch {
        resolve([]);
      }
    };
    const onVoices = () => done();
    const timer = setTimeout(done, timeoutMs);
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', onVoices, {
        once: true,
      });
    }
  });
}

function pickVoice(locale) {
  if (!hasWebSpeech()) return null;
  ensureVoicesPrewarmed();
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  const lowerLocale = locale.toLowerCase();
  const localePrefix = lowerLocale.split('-')[0];
  const localVoices = voices.filter((v) => v.localService === true);

  if (lowerLocale === 'en-us') {
    const preferredLocalEn = localVoices.find(
      (v) =>
        v.lang &&
        v.lang.toLowerCase().startsWith('en') &&
        /samantha|ava|allison|nicky|alex|daniel|aaron|karen|moira|tessa/i.test(
          v.name || ''
        )
    );
    if (preferredLocalEn) return preferredLocalEn;
  }

  const localExact = localVoices.find(
    (v) => v.lang && v.lang.toLowerCase() === lowerLocale
  );
  if (localExact) return localExact;

  const localPrefix = localVoices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith(localePrefix)
  );
  if (localPrefix) return localPrefix;

  const remoteExact = voices.find(
    (v) => v.lang && v.lang.toLowerCase() === lowerLocale
  );
  if (remoteExact) return remoteExact;

  const remotePrefix = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith(localePrefix)
  );
  return remotePrefix || null;
}

function clearSpeakTimers() {
  if (speakDelayTimer) {
    clearTimeout(speakDelayTimer);
    speakDelayTimer = null;
  }
  if (startWatchdogTimer) {
    clearTimeout(startWatchdogTimer);
    startWatchdogTimer = null;
  }
  if (maxDurationTimer) {
    clearTimeout(maxDurationTimer);
    maxDurationTimer = null;
  }
}

function stopActiveAudio() {
  if (!activeAudio) return;
  try {
    activeAudio.onplay = null;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch {
    // Ignore audio stop errors
  }
  activeAudio = null;
}

function playGoogleTts(text, lang, token, { onStart, onEnd, onError } = {}) {
  if (
    typeof Audio === 'undefined' ||
    token !== speakToken ||
    text.length > GOOGLE_TTS_MAX_CHARS ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return Promise.resolve(false);
  }

  const url = buildGoogleTtsUrl(text, lang);

  return new Promise((resolve) => {
    try {
      stopActiveAudio();
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 1;
      activeAudio = audio;

      let started = false;
      let finished = false;
      let resolvedStart = false;

      const clearStartTimer = () => {
        if (startWatchdogTimer) {
          clearTimeout(startWatchdogTimer);
          startWatchdogTimer = null;
        }
      };

      const settleStart = (ok) => {
        if (resolvedStart) return;
        resolvedStart = true;
        clearStartTimer();
        resolve(ok);
      };

      const finish = (cb, arg) => {
        if (finished) return;
        finished = true;
        clearStartTimer();
        if (activeAudio === audio) {
          activeAudio = null;
        }
        cb?.(arg);
      };

      audio.onplay = () => {
        if (token !== speakToken) {
          stopActiveAudio();
          settleStart(false);
          return;
        }
        started = true;
        settleStart(true);
        onStart?.();
      };

      audio.onended = () => {
        finish(onEnd);
      };

      audio.onerror = (err) => {
        if (!started) {
          stopActiveAudio();
          settleStart(false);
        } else {
          finish(onError, err);
        }
      };

      startWatchdogTimer = setTimeout(() => {
        if (!started && token === speakToken) {
          stopActiveAudio();
          settleStart(false);
        }
      }, GOOGLE_TTS_START_TIMEOUT_MS);

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (!started) {
            stopActiveAudio();
            settleStart(false);
          }
        });
      }
    } catch {
      stopActiveAudio();
      resolve(false);
    }
  });
}

async function speakWithWebSpeech(
  cleaned,
  locale,
  token,
  { rate = 0.95, wasBusy = false, onStart, onEnd, onError } = {}
) {
  if (!hasWebSpeech() || token !== speakToken) {
    if (token === speakToken) onError?.();
    return;
  }

  const synth = window.speechSynthesis;
  await waitForVoices();
  if (token !== speakToken) return;

  try {
    const utterance = new SpeechSynthesisUtterance(cleaned);
    activeUtterance = utterance;
    utterance.lang = locale;
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = pickVoice(locale);
    if (voice) {
      utterance.voice = voice;
    }

    let started = false;
    let finished = false;

    const cleanupUtterance = () => {
      clearSpeakTimers();
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
    };

    const finish = (cb, arg) => {
      if (finished) return;
      finished = true;
      cleanupUtterance();
      cb?.(arg);
    };

    utterance.onstart = () => {
      if (token !== speakToken || finished) return;
      started = true;
      if (startWatchdogTimer) {
        clearTimeout(startWatchdogTimer);
        startWatchdogTimer = null;
      }
      maxDurationTimer = setTimeout(() => {
        if (token === speakToken) {
          finish(onEnd);
        }
      }, 12000);
      onStart?.();
    };

    utterance.onend = () => {
      if (token !== speakToken) return;
      finish(onEnd);
    };

    utterance.onerror = (event) => {
      if (token !== speakToken) return;
      if (event?.error === 'canceled' || event?.error === 'interrupted') {
        finish(onEnd);
        return;
      }
      finish(onError, event);
    };

    const runSpeak = () => {
      if (token !== speakToken || finished) return;
      try {
        if (synth.paused) {
          synth.resume();
        }
        synth.speak(utterance);

        startWatchdogTimer = setTimeout(() => {
          if (
            token !== speakToken ||
            started ||
            finished ||
            synth.speaking
          ) {
            return;
          }
          finish(onEnd);
        }, 1200);
      } catch (err) {
        finish(onError, err);
      }
    };

    if (wasBusy) {
      speakDelayTimer = setTimeout(runSpeak, 60);
    } else {
      runSpeak();
    }
  } catch (err) {
    if (token === speakToken) {
      onError?.(err);
    }
  }
}

export function stopSpeaking() {
  speakToken += 1;
  clearSpeakTimers();
  stopActiveAudio();
  activeUtterance = null;

  if (!hasWebSpeech()) return;
  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }
  } catch {
    // Ignore speech cancellation errors
  }
}

export function speakWord(
  text,
  lang = 'English',
  { rate = 0.95, onStart, onEnd, onError } = {}
) {
  const cleaned = String(text || '').trim();
  if (!cleaned || !isSpeechSupported()) {
    return false;
  }

  const locale = getPreferredLocale(lang);
  const synth = hasWebSpeech() ? window.speechSynthesis : null;
  const wasBusy = Boolean(synth && (synth.speaking || synth.pending));

  warmUpAudioContext();
  stopSpeaking();
  const token = speakToken;

  (async () => {
    const playedGoogle = await playGoogleTts(cleaned, lang, token, {
      onStart,
      onEnd,
      onError,
    });
    if (playedGoogle || token !== speakToken) return;

    await speakWithWebSpeech(cleaned, locale, token, {
      rate,
      wasBusy,
      onStart,
      onEnd,
      onError,
    });
  })();

  return true;
}
