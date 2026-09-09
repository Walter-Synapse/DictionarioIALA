/**
 * Declaración estricta para data.js - 51.500 palabras de Interlingua
 * Este archivo define el contrato TypeScript sin que data.js sea parseado
 * internamente por el compilador en cada guardado (ver Fase 0 regla 2).
 */
export interface LexiconEntry {
  readonly word: string;
  readonly pos: string;
  readonly stressHtml?: string;
}

export type LexiconData = Readonly<readonly LexiconEntry[]>;

/**
 * Subconjuntos por categoría POS (usados por app.ts y conjugator.ts)
 */
export type VerbMap = Readonly<Record<string, number>>;
export type AdjMap = Readonly<Record<string, number>>;
export type SbMap = Readonly<Record<string, number>>;
export type AdvMap = Readonly<Record<string, number>>;
export type DictMap = Readonly<Record<string, readonly LexiconEntry[]>>;