// Resultato del transcriction phonetic e syllabification
export interface SyllabificationResult {
  readonly syllables: readonly string[];
  readonly tonicIndex: number;
  readonly ipa: string;
}