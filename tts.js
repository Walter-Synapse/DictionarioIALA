/**
 * =============================================================================
 * Dictionario IALA - Synthetisator de Voce via Proxy Audio
 * =============================================================================
 *
 * Modulo pro le generation de audio parlate in Interlingua.
 * Usa un proxy Cloudflare Worker que gere le securitate server-side.
 *
 * Functionalitates:
 * - Voces neural Wavenet/Neural2 (it-IT-Neural2-E e it-IT-Neural2-F).
 * - Transcriber phonetic automatic a SSML + IPA de Interlingua.
 * - IndexedDB Audio Store: persiste audio localmente in le navigator
 *   (evita requistas de rete duplicate in sessiones future).
 * - Configuration via env.js / window.__IALA_CONFIG__.
 */

(function(global) {
  'use strict';

  // URL del proxy Cloudflare Worker — le clave API non es jammais exposta al cliente
  function getProxyEndpoint() {
    if (window.__IALA_CONFIG__ && window.__IALA_CONFIG__.VOX_PROXY_URL) {
      return window.__IALA_CONFIG__.VOX_PROXY_URL;
    }
    return null;
  }

  const LANG_CODE = "it-IT";

  // Configuration de voces Wavenet/Neural2 pro Interlingua
  const AVAILABLE_VOICES = [
    {
      id: 'it-IT-Neural2-E',
      name: 'it-IT-Neural2-E',
      label: 'Voz Feminina (Neural2-E)',
      gender: 'f',
      flag: 'IA'
    },
    {
      id: 'it-IT-Neural2-F',
      name: 'it-IT-Neural2-F',
      label: 'Voz Masculina (Neural2-F)',
      gender: 'm',
      flag: 'IA'
    }
  ];

  const STORAGE_KEY_VOICE = 'iala_tts_voice';
  const STORAGE_KEY_RATE = 'iala_tts_rate';

  let selectedVoice = (function() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOICE);
      if (saved && AVAILABLE_VOICES.some(function(v) { return v.id === saved; })) {
        return saved;
      }
    } catch (e) {}
    return 'it-IT-Neural2-E';
  })();

  let speakingRate = (function() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RATE);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.5 && val <= 1.5) return val;
      }
    } catch (e) {}
    return 0.95;
  })();

  // ---------------------------------------------------------------------------
  // IndexedDB Persistent Audio Cache
  // ---------------------------------------------------------------------------
  const DB_NAME = 'IALA_Audio_DB';
  const DB_VERSION = 1;
  const STORE_NAME = 'audio_cache';
  let dbPromise = null;

  function getDB() {
    if (dbPromise) return dbPromise;
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }
    dbPromise = new Promise(function(resolve) {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = function(e) {
          resolve(e.target.result);
        };
        req.onerror = function(e) {
          console.warn('[IndexedDB] Errore de apertura:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[IndexedDB non supportate]:', err);
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function getAudioFromDB(key) {
    const db = await getDB();
    if (!db) return null;
    return new Promise(function(resolve) {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = function() {
          if (req.result && req.result.blob) {
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = function() { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function saveAudioToDB(key, blob) {
    const db = await getDB();
    if (!db) return;
    try {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key: key, blob: blob, timestamp: Date.now() });
    } catch (e) {
      console.warn('[IndexedDB Store Error]:', e);
    }
  }

  // Cache in memoria RAM: clave -> Blob URL
  const memoryCache = new Map();
  let currentAudioElement = null;

  /**
   * Sanitisa le codice SSML pro assecurar un parseo XML sin errores in Google Cloud TTS.
   */
  function sanitizeSsml(ssml) {
    if (!ssml) return '';
    if (ssml.startsWith('<speak>') && ssml.endsWith('</speak>')) {
      const inner = ssml.slice(7, -8);
      const fixedInner = inner.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
      return '<speak>' + fixedInner + '</speak>';
    }
    return ssml;
  }

  /**
   * Cessa le audio currente si illo es in reproduction.
   */
  function stopCurrentAudio() {
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      } catch (e) {}
      currentAudioElement = null;
    }
  }

  /**
   * Synthesisa e reproduce un texto in Interlingua per Google Cloud TTS.
   * @param {string} rawText - Parola o texto a audir.
   * @param {Object} [options] - Configuration opcional { voice, speakingRate, onStart, onEnd, onError }
   */
  async function speak(rawText, options) {
    options = options || {};
    stopCurrentAudio();

    if (!rawText || typeof rawText !== 'string') return;

    let textToProcess = rawText.trim();
    if (!textToProcess) return;

    // Transcriber a SSML con phonemas IPA stricte
    let ssmlPayload = '';
    if (global.InterlinguaTranscriber && typeof global.InterlinguaTranscriber.transcribeInterlinguaToSsml === 'function') {
      try {
        ssmlPayload = global.InterlinguaTranscriber.transcribeInterlinguaToSsml(textToProcess);
      } catch (e) {
        console.warn('[TTS] Error in InterlinguaTranscriber, usante texto pur:', e);
        ssmlPayload = '';
      }
    }

    const voiceName = options.voice || selectedVoice;
    const rate = options.speakingRate || speakingRate;
    const cacheKey = `${voiceName}_${rate}_${ssmlPayload || textToProcess}`;

    // 1. NIVEL 1 DE CACHE: Memoria RAM instantanee
    if (memoryCache.has(cacheKey)) {
      console.log(`%c[TTS Audio]%c Reproducente ab %c[RAM Memory Cache]%c pro: "${textToProcess}"`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;', 'color: #10b981; font-weight: bold;', 'color: inherit;');
      const cachedUrl = memoryCache.get(cacheKey);
      playAudioUrl(cachedUrl, options);
      return;
    }

    // 2. NIVEL 2 DE CACHE: IndexedDB local permanente
    try {
      const dbBlob = await getAudioFromDB(cacheKey);
      if (dbBlob) {
        console.log(`%c[TTS Audio]%c Recuperate ab %c[IndexedDB Local Storage]%c (0ms rete) pro: "${textToProcess}"`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;', 'color: #8b5cf6; font-weight: bold;', 'color: inherit;');
        const audioUrl = URL.createObjectURL(dbBlob);
        memoryCache.set(cacheKey, audioUrl);
        playAudioUrl(audioUrl, options);
        return;
      }
    } catch (dbErr) {
      console.warn('[IndexedDB Cache Read Skip]:', dbErr);
    }

    const requestBody = {
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: rate
      },
      voice: {
        languageCode: LANG_CODE,
        name: voiceName
      }
    };

    if (ssmlPayload) {
      requestBody.input = { ssml: sanitizeSsml(ssmlPayload) };
    } else {
      requestBody.input = { text: textToProcess };
    }

    const proxyUrl = getProxyEndpoint();
    if (!proxyUrl) {
      const tokenErr = new Error('Proxy de audio non configurate (VOX_PROXY_URL).');
      console.error('[Audio Gateway]', tokenErr.message);
      if (options.onError) options.onError(tokenErr);
      return;
    }

    try {
      if (options.onStart) options.onStart();

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(function() { return {}; });
        const errMsg = (errJson.error && errJson.error.message) ? errJson.error.message : `HTTP ${response.status}`;
        console.error('[Google Cloud TTS Error]:', errMsg);
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (!data.audioContent) {
        throw new Error('Nulle audioContent retornate per Google Cloud TTS');
      }

      // Converter Base64 a ArrayBuffer e Blob MP3
      const binaryString = window.atob(data.audioContent);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log(`%c[TTS Audio]%c Generato noviter via %c[Google Cloud TTS API (Rete)]%c pro: "${textToProcess}" (%c${voiceName}%c, %c${textToProcess.length} chars%c)`, 
        'color: #3b82f6; font-weight: bold;', 'color: inherit;', 
        'color: #f59e0b; font-weight: bold;', 'color: inherit;',
        'color: #06b6d4; font-weight: bold;', 'color: inherit;',
        'color: #ec4899; font-weight: bold;', 'color: inherit;'
      );

      // Salvar in RAM Cache
      memoryCache.set(cacheKey, audioUrl);

      // Salvar in IndexedDB permanente (Background save)
      saveAudioToDB(cacheKey, audioBlob);

      playAudioUrl(audioUrl, options);
    } catch (err) {
      console.error('[Google TTS Fallimento]', err);
      if (options.onError) options.onError(err);
      if (typeof window !== 'undefined' && options.showNotification !== false) {
        console.warn(`[Audio Non Disponibile]: ${err.message}`);
      }
    }
  }

  /**
   * Reproduce un URL de audio e gere le eventos de stato.
   */
  function playAudioUrl(url, options) {
    const audio = new Audio(url);
    currentAudioElement = audio;

    if (options.onStart) {
      audio.addEventListener('play', function() {
        if (options.onStart) options.onStart();
      }, { once: true });
    }

    audio.addEventListener('ended', function() {
      if (currentAudioElement === audio) currentAudioElement = null;
      if (options.onEnd) options.onEnd();
    }, { once: true });

    audio.addEventListener('error', function(e) {
      if (currentAudioElement === audio) currentAudioElement = null;
      if (options.onError) options.onError(e);
    }, { once: true });

    audio.play().catch(function(e) {
      console.warn('[Audio Play Error]:', e);
      if (options.onError) options.onError(e);
    });
  }

  function setVoice(voiceId) {
    if (AVAILABLE_VOICES.some(function(v) { return v.id === voiceId; })) {
      selectedVoice = voiceId;
      try {
        localStorage.setItem(STORAGE_KEY_VOICE, voiceId);
      } catch (e) {}
    }
  }

  function getVoice() {
    return selectedVoice;
  }

  function setSpeakingRate(rate) {
    const val = parseFloat(rate);
    if (!isNaN(val) && val >= 0.5 && val <= 1.5) {
      speakingRate = val;
      try {
        localStorage.setItem(STORAGE_KEY_RATE, val.toString());
      } catch (e) {}
    }
  }

  function getSpeakingRate() {
    return speakingRate;
  }

  function getAvailableVoices() {
    return AVAILABLE_VOICES;
  }

  const GoogleTTS = {
    speak: speak,
    stop: stopCurrentAudio,
    setVoice: setVoice,
    getVoice: getVoice,
    setSpeakingRate: setSpeakingRate,
    getSpeakingRate: getSpeakingRate,
    getAvailableVoices: getAvailableVoices,
    AVAILABLE_VOICES: AVAILABLE_VOICES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleTTS;
  }
  global.GoogleTTS = GoogleTTS;

})(typeof window !== 'undefined' ? window : globalThis);
