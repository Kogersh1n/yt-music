export interface ApiSong {
  id: string;
  title: string;
  author: string;
  duration: number;
  cover_url: string | null;
  created_at?: string;
  liked?: boolean;
}

export interface PlayingSong extends ApiSong {
  url: string;
  isYouTubeStream?: boolean;
  youtubeId?: string;
}

export interface YouTubeResult {
  video_id: string;
  title: string;
  author: string | null;
  duration: number;
  cover: string;
  url: string;
}

export type RepeatMode = 'off' | 'all' | 'one';