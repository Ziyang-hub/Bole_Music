declare module 'st-shazam' {
  interface SongInfo {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    cover?: string;
  }

  export function recognizeSong(filePath: string): Promise<SongInfo | null>;
  export function processAudio(filePath: string): Promise<any>;
}
