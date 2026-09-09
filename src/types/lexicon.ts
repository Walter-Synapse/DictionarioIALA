// Entrata de lexico pro Interlingua IALA
export interface LexiconEntry {
  readonly word: string;
  readonly definition: string;
  readonly pos?: string; // Part of Speech / Parte del discurso
  readonly etymology?: string; // Etymologia del vocabulo
}
export type LexiconMap = Readonly<Record<string, string>>;