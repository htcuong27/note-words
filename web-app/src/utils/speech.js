/**
 * Web Speech API pronunciation helpers with Chrome/macOS race-condition fixes
 * and dictionary audio fallback (works offline via Web Speech API first).
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

let voicesListenerAttached = false;
let activeUtterance = null;
let activeAudio = null;
let speakDelayTimer = null;
let startWatchdogTimer = null;
let maxDurationTimer = null;
let speakToken = 0;

const audioUrlCache = new Map();

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

if (typeof window !== 'undefined') {
  ensureVoicesPrewarmed();
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
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch {
    // Ignore audio stop errors
  }
  activeAudio = null;
}

async function resolveFallbackAudioUrl(word, locale) {
  if (!locale.toLowerCase().startsWith('en')) return null;
  if (!/^[a-zA-Z'-]+$/.test(word)) return null;

  const key = word.toLowerCase();
  if (audioUrlCache.has(key)) {
    return audioUrlCache.get(key);
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`
    );
    if (!res.ok) {
      audioUrlCache.set(key, null);
      return null;
    }
    const entries = await res.json();
    let foundUrl = null;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const phonetics = Array.isArray(entry?.phonetics) ? entry.phonetics : [];
        const match = phonetics.find(
          (p) => typeof p?.audio === 'string' && p.audio.trim().length > 0
        );
        if (match) {
          const raw = match.audio.trim();
          foundUrl = raw.startsWith('//') ? `https:${raw}` : raw;
          break;
        }
      }
    }
    audioUrlCache.set(key, foundUrl);
    return foundUrl;
  } catch {
    return null;
  }
}

async function playFallbackAudio(
  word,
  locale,
  token,
  { onStart, onEnd, onError } = {}
) {
  if (typeof Audio === 'undefined') return false;
  const url = await resolveFallbackAudioUrl(word, locale);
  if (!url || token !== speakToken) return false;

  try {
    stopActiveAudio();
    const audio = new Audio(url);
    activeAudio = audio;

    let done = false;
    const finish = (cb, arg) => {
      if (done) return;
      done = true;
      if (activeAudio === audio) {
        activeAudio = null;
      }
      cb?.(arg);
    };

    audio.onplay = () => {
      if (token !== speakToken) {
        stopActiveAudio();
        return;
      }
      onStart?.();
    };
    audio.onended = () => {
      finish(onEnd);
    };
    audio.onerror = (err) => {
      finish(onError, err);
    };

    await audio.play();
    return true;
  } catch (err) {
    stopActiveAudio();
    if (token === speakToken) {
      onError?.(err);
    }
    return false;
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

  stopSpeaking();
  const token = speakToken;

  if (!synth) {
    playFallbackAudio(cleaned, locale, token, { onStart, onEnd, onError }).then(
      (played) => {
        if (!played && token === speakToken) {
          onError?.();
        }
      }
    );
    return true;
  }

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
      cleanupUtterance();
      finished = true;
      playFallbackAudio(cleaned, locale, token, {
        onStart,
        onEnd,
        onError,
      }).then((played) => {
        if (!played && token === speakToken) {
          onError?.(event);
        }
      });
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
          finished = true;
          cleanupUtterance();
          try {
            if (synth.speaking || synth.pending) {
              synth.cancel();
            }
          } catch {
            // Ignore cancel error
          }
          playFallbackAudio(cleaned, locale, token, {
            onStart,
            onEnd,
            onError,
          }).then((played) => {
            if (!played && token === speakToken) {
              onEnd?.();
            }
          });
        }, 900);
      } catch (err) {
        finish(onError, err);
      }
    };

    if (wasBusy) {
      speakDelayTimer = setTimeout(runSpeak, 60);
    } else {
      runSpeak();
    }

    return true;
  } catch (err) {
    onError?.(err);
    return false;
  }
}
