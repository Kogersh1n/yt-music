// src/mockSongs.ts

export interface Song {
  id: number;
  title: string;
  author: string;
}

export const MOCK_SONGS = [
  {
    id: 1,
    title: "Blinding Lights",
    author: "The Weeknd",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
  },
  {
    id: 2,
    title: "Starboy",
    author: "The Weeknd",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  }
];