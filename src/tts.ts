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
 * - Configuration via env.ts / window.__IALA_CONFIG__.
 */

'use strict';

// URL del proxy Cloudflare Worker — le clave API non es jammais exposta al cliente
import { PROXY_URL } from './env';

function getProxyEndpoint(): string | null {
  if (window.__IALA_CONFIG__?.VOX_PROXY_URL) {
    return window.__IALA_CONFIG__.VOX_PROXY_URL;
  }
  return PROXY_URL || null;
}

const LANG_CODE = 'it-IT';

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

let selectedVoice = (function(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_VOICE);
    if (saved && AVAILABLE_VOICES.some(function(v) { return v.id === saved; })) {
      return saved;
    }
  } catch (_e) {}
  return 'it-IT-Neural2-E';
})();

let speakingRate = (function(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RATE);
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.5 && val <= 1.5) return val;
    }
  } catch (_e) {}
  return 0.95;
})();

// ---------------------------------------------------------------------------
// IndexedDB Persistent Audio Cache
// ---------------------------------------------------------------------------
const DB_NAME = 'IALA_Audio_DB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_cache';
let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  dbPromise = new Promise<IDBDatabase | null>(function(resolve) {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e: IDBVersionChangeEvent) {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = function(e: Event) {
        resolve((e.target as IDBOpenDBRequest).result);
      };
      req.onerror = function(e: Event) {
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

async function getAudioFromDB(key: string): Promise<Blob | null> {
  const db = await getDB();
  if (!db) return null;
  return new Promise<Blob | null>(function(resolve) {
    try {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = function() {
        if (req.result && req.result.blob) {
          resolve(req.result.blob as Blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = function() { resolve(null); };
    } catch (_e) {
      resolve(null);
    }
  });
}

async function saveAudioToDB(key: string, blob: Blob): Promise<void> {
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
const memoryCache = new Map<string, string>();
let currentAudioElement: HTMLAudioElement | null = null;

/**
 * Sanitisa le codice SSML pro assecurar un parseo XML sin errores in Google Cloud TTS.
 */
function sanitizeSsml(ssml: string): string {
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
function stopCurrentAudio(): void {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch (_e) {}
    currentAudioElement = null;
  }
}

// Typo de options pro la fonction speak
interface SpeakOptions {
  voice?: string;
  speakingRate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  showNotification?: boolean;
}

// Typo del payload TTS pro Google Cloud
interface TTSRequestBody {
  audioConfig: { audioEncoding: string; speakingRate: number };
  voice: { languageCode: string; name: string };
  input?: { ssml?: string; text?: string };
}

/**
 * Synthesisa e reproduce un texto in Interlingua per Google Cloud TTS.
 * @param rawText - Parola o texto a audir.
 * @param options - Configuration opcional
 */
async function speak(rawText: string, options: SpeakOptions = {}): Promise<void> {
  stopCurrentAudio();

  if (!rawText || typeof rawText !== 'string') return;

  let textToProcess = rawText.trim();
  if (!textToProcess) return;

  // Transcriber a SSML con phonemas IPA stricte
  let ssmlPayload = '';
  if (window.InterlinguaTranscriber && typeof window.InterlinguaTranscriber.transcribeInterlinguaToSsml === 'function') {
    try {
      ssmlPayload = window.InterlinguaTranscriber.transcribeInterlinguaToSsml(textToProcess);
    } catch (_e) {
      console.warn('[TTS] Error in InterlinguaTranscriber, usante texto pur:', _e);
      ssmlPayload = '';
    }
  }

  const voiceName = options.voice ?? selectedVoice;
  const rate = options.speakingRate ?? speakingRate;
  const cacheKey = `${voiceName}_${rate}_${ssmlPayload || textToProcess}`;

  // Nivel 1 de cache: Memoria RAM instantanee
  if (memoryCache.has(cacheKey)) {
    const cachedUrl = memoryCache.get(cacheKey)!;
    playAudioUrl(cachedUrl, options);
    return;
  }

  // Nivel 2 de cache: IndexedDB local permanente
  try {
    const dbBlob = await getAudioFromDB(cacheKey);
    if (dbBlob) {
      const audioUrl = URL.createObjectURL(dbBlob);
      memoryCache.set(cacheKey, audioUrl);
      playAudioUrl(audioUrl, options);
      return;
    }
  } catch (dbErr) {
    console.warn('[IndexedDB Cache Read Skip]:', dbErr);
  }

  const requestBody: TTSRequestBody = {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(function() { return {}; }) as { error?: { message?: string } };
      const errMsg = errJson.error?.message ?? `HTTP ${response.status}`;
      console.error('[Google Cloud TTS Error]:', errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json() as { audioContent?: string };
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

    // Salvar in RAM Cache
    memoryCache.set(cacheKey, audioUrl);

    // Salvar in IndexedDB permanente (Background save)
    void saveAudioToDB(cacheKey, audioBlob);

    playAudioUrl(audioUrl, options);
  } catch (err: unknown) {
    console.error('[Google TTS Fallimento]', err);
    if (options.onError) options.onError(err);
    if (typeof window !== 'undefined' && options.showNotification !== false) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Audio Non Disponibile]: ${msg}`);
    }
  }
}

/**
 * Reproduce un URL de audio e gere le eventos de stato.
 */
function playAudioUrl(url: string, options: SpeakOptions): void {
  const audio = new Audio(url);
  currentAudioElement = audio;

  if (options.onStart) {
    audio.addEventListener('play', function() {
      if (options.onStart) options.onStart!();
    }, { once: true });
  }

  audio.addEventListener('ended', function() {
    if (currentAudioElement === audio) currentAudioElement = null;
    if (options.onEnd) options.onEnd();
  }, { once: true });

  audio.addEventListener('error', function(e) {
    if (currentAudioElement === audio) currentAudioElement = null;
    if (options.onError) options.onError!(e);
  }, { once: true });

  audio.play().catch(function(e: unknown) {
    console.warn('[Audio Play Error]:', e);
    if (options.onError) options.onError!(e);
  });
}

function setVoice(voiceId: string): void {
  if (AVAILABLE_VOICES.some(function(v) { return v.id === voiceId; })) {
    selectedVoice = voiceId;
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, voiceId);
    } catch (_e) {}
  }
}

function getVoice(): string {
  return selectedVoice;
}

function setSpeakingRate(rate: number | string): void {
  const val = parseFloat(String(rate));
  if (!isNaN(val) && val >= 0.5 && val <= 1.5) {
    speakingRate = val;
    try {
      localStorage.setItem(STORAGE_KEY_RATE, val.toString());
    } catch (_e) {}
  }
}

function getSpeakingRate(): number {
  return speakingRate;
}

function getAvailableVoices(): typeof AVAILABLE_VOICES {
  return AVAILABLE_VOICES;
}

// API publica del modulo
export const GoogleTTS = {
  speak,
  stop: stopCurrentAudio,
  setVoice,
  getVoice,
  setSpeakingRate,
  getSpeakingRate,
  getAvailableVoices,
  AVAILABLE_VOICES
};

// Retrocompatibilitate con scripts global
if (typeof window !== 'undefined') {
  window.GoogleTTS = GoogleTTS as typeof window.GoogleTTS;
}
