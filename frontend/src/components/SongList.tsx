// src/components/SongList.tsx
import type { ApiSong } from '../api/songs.ts'
import SongCard from './SongCard.tsx'


interface SongListProps {
    songs: ApiSong[]
    currentSong: ApiSong | null
    onSongSelect: (song: ApiSong) => void
}

function SongList({songs, currentSong, onSongSelect}: SongListProps){
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {songs.map((song) => {
                return (
                <SongCard
                    key={song.id} 
                    song={song}
                    isActive={currentSong?.id === song.id}
                    onClick={() => onSongSelect(song)}
                    />
            );
        })}
        </div>
    );
}

export default SongList;