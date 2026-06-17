import type { ApiSong } from '../api/songs';

export interface PlayingSong extends ApiSong {
    url: string;
}