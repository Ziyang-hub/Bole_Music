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
    recognise(path: string, language?: string, minimal?: boolean): Promise<any>;
    fromFilePath(path: string, minimal?: boolean, language?: string): Promise<any>;
    recognizeSong(samples: number[], language?: string): Promise<any>;
    search_music(query: string, language?: string, country?: string, limit?: string, offset?: string): Promise<any>;
  }
}
