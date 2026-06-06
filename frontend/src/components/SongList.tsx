// src/components/SongList.tsx
import SongCard from './SongCard.tsx'

interface Song {
    id: number
    title: string
    author: string
    url: string
}

interface SongListProps {
    songs: Song[]
    currentSong: Song | null
    onSongSelect: (song: Song) => void
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