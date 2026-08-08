declare module 'node-shazam' {
  interface ShazamTrack {
    title?: string;
    subtitle?: string;
    artist?: string;
    album?: string;
    genres?: string[];
    images?: any;
  }

  interface ShazamResult {
    track?: ShazamTrack;
    title?: string;
    subtitle?: string;
    artist?: string;
  }

  export class Shazam {
    constructor();
    recognise(filePath: string): Promise<ShazamResult>;
    recognizeSong(filePath: string): Promise<any>;
    search_music(query: string): Promise<any>;
  }
}
