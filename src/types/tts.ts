// Configuration de audio pro synthesis de voce (TTS)
export interface AudioConfig {
  readonly voice: string;
  readonly speed: number;
  readonly pitch: number;
  readonly volume: number;
}