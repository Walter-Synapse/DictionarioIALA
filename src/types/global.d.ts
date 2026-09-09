/**
 * Declarationes de ambiente pro proprietates global del projecto IALA.
 * Evita errores TS2339 / TS7017 super Window & typeof globalThis.
 */

// Typo de entrata crude del dictionario in data.js (array positional)
export type RawDictEntry = readonly [string, string, string, string?, string?];

// Paradigma de conjugation verbal (retornate per conjugateInterlingua)
export interface VerbParadigm {
  type?: string;
  infinitive: string;
  stem: string;
  vowel: string;
  imperative: string;
  part_pres: string;
  part_pass: string;
  participio_presente?: string;
  participio_passate?: string;
  gerundio?: string;
  active_simple: {
    presente: string;
    passato: string;
    futuro: string;
    futuro_word?: string;
    conditional: string;
    conditional_word?: string;
    imperative?: string;
  };
  active_perfecte: {
    presente: string;
    passato: string;
    futuro: string;
    conditional: string;
  };
  passive_simple: {
    presente: string;
    passato: string;
    futuro: string;
    conditional: string;
  };
  passive_perfecte?: {
    presente: string;
    passato: string;
    futuro: string;
    conditional: string;
  };
}

// Paradigma de inflexion adjectival (retornate per inflectAdjective)
export interface AdjParadigm {
  type?: string;
  adjective: string;
  base?: string;
  compPos: string;
  compNeg: string;
  supPos: string;
  supNeg: string;
  absSup: string;
  adverb: string;
  substantiveM: string;
  substantiveF: string;
  isInvariantSubstantive: boolean;
  substantivationNote: string;
  irregular?: {
    comp?: string;
    sup?: string;
    adv?: string;
    advComp?: string;
  } | null;
}

// Paradigma de pluralisation nominal (retornate per pluralizeNoun)
export interface NounParadigm {
  type?: string;
  singular: string;
  plural: string;
  rule: string;
}

// Resultato de analyse de accentuation (computeIALAStressHTML)
export interface StressResult {
  html: string;
  isIrregular: boolean;
  ruleDesc: string;
}

export interface CollateralMatch {
  sourceWord: string;
  classicalWord: string;
  ruleId: string;
  desc: string;
  dictEntry?: unknown;
}

export interface VerbDeconjugation {
  sourceLanguage?: string;
  sourceWord: string;
  infinitive: string;
  tense: string;
  formula: string;
  equivalent?: string;
  paradigm?: VerbParadigm | null;
}

// Resultato de deconstruction / analyse (deconstructUniversal, analyzeTextTokenContextual)
export interface AnalysisResult {
  category?: string;
  word?: string;
  root?: string;
  pos?: string;
  status?: string;
  desc?: string;
  tense?: string;
  formula?: string;
  transcription?: string;
  ipa?: string;
  sourceWord?: string;
  singular?: string;
  rule?: string;
  nounData?: NounParadigm | null;
  baseAdjective?: string;
  paradigm?: VerbParadigm | AdjParadigm | NounParadigm | null;
  suggestions?: Array<{ word: string; distance: number }>;
  matches?: CollateralMatch[];
  iaWord?: string;
  stem?: string;
  stemCategory?: string;
  prefix?: string;
  suffix?: string;
  data?: VerbDeconjugation;
  dictEntry?: RawDictEntry | unknown[];
  isIrregular?: boolean;
  html?: string;
  equivalent?: string;
}

export interface IALAConjugatorAPI {
  conjugate: (infinitive: string) => VerbParadigm | null;
  inflectAdjective: (adjective: string) => AdjParadigm | null;
  pluralizeNoun: (noun: string) => NounParadigm | null;
  deconjugateInterlingua: (form: string, verbMap: Record<string, number>) => AnalysisResult[];
  deconstructUniversal: (query: string, dictData: unknown, verbMap: Record<string, number>, adjMap: Record<string, number>, sbMap: Record<string, number>) => AnalysisResult | null;
  resolveCollateralOrthography: (word: string, dictMap: unknown) => CollateralMatch[];
  computeIALAStressHTML: (word: string, overrideHtml: string, pos?: string) => StressResult;
  getInterlinguaIPA: (word: string, overrideHtml?: string) => string;
  levenshteinDistance: (a: string, b: string) => number;
  findSpellingSuggestions: (word: string, vocab: string[], maxDist?: number, maxResults?: number) => Array<{ word: string; distance: number }>;
  analyzeTextTokenContextual: (tokenInfo: { tok: string; low: string; prevLow?: string; nextLow?: string }, dictMulti: Record<string, RawDictEntry[]>, verbMap: Record<string, number>, adjMap: Record<string, number>, sbMap: Record<string, number>, vocabList: string[]) => AnalysisResult | null;
  numAtomInterlingua: (n: number) => string;
  transcribeIntInterlingua: (n: number) => string;
  transcribeNumberFullInterlingua: (s: string | number) => string | null;
}

export interface GoogleTTSAPI {
  speak: (text: string, options?: {
    voice?: string;
    speakingRate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
    showNotification?: boolean;
  }) => Promise<void>;
  stop: () => void;
  setVoice: (voiceId: string) => void;
  getVoice: () => string;
  setSpeakingRate: (rate: number | string) => void;
  getSpeakingRate: () => number;
  getAvailableVoices: () => Array<{ id: string; name: string; label: string; gender: string; flag: string }>;
  AVAILABLE_VOICES: Array<{ id: string; name: string; label: string; gender: string; flag: string }>;
}

export interface AudioConfigModalAPI {
  open: () => void;
  init: () => void;
}

export interface IALAConfig {
  VOX_PROXY_URL: string;
}

declare global {
  interface Window {
    DICTIONARIO_DATA: RawDictEntry[];
    IALAConjugator: IALAConjugatorAPI;
    GoogleTTS: GoogleTTSAPI;
    AudioConfigModal: AudioConfigModalAPI;
    InterlinguaTranscriber: {
      transcribeInterlinguaToSsml: (text: string) => string;
      getInterlinguaIpaString: (text: string) => string;
      transcribeWordInterlingua: (word: string) => string;
      iaLetterName: (c: string) => string | null;
      numAtomInterlingua: (n: number) => string;
      transcribeIntInterlingua: (n: number) => string;
      preprocessInterlinguaText: (text: string) => string;
    };
    __IALA_CONFIG__?: IALAConfig;
  }
}
