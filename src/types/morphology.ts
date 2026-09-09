// Definitiones de typo pro le motor morphologic
export type VerbConjugationGroup = '1st (-ar)' | '2nd (-er)' | '3rd (-ir)';
export type VerbTense = 'present' | 'preterite' | 'future' | 'conditional';

// Resultado de deconstruction morphologic de un parola
export interface DeconstructionResult {
  readonly original: string;
  readonly lemma: string;
  readonly pos: 'verb' | 'noun' | 'adjective' | 'adverb' | 'unknown';
  readonly details?: string;
  readonly ruleApplied?: string;
}

// Analise statistic de un paragrapho complete
export interface ParagraphAnalysis {
  readonly tokens: readonly TokenAnalysis[];
  readonly totalWords: number;
  readonly recognizedWords: number;
  readonly coverageRatio: number;
}

// Analise individual de un token textual
export interface TokenAnalysis {
  readonly token: string;
  readonly low: string;
  readonly pos: string;
  readonly status: 'known' | 'unknown';
  readonly root?: string;
}