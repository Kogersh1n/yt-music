import type { ApiSong } from '../api/songs.ts'
import SongList from '../components/SongList.tsx'


interface HomePageProps {
    songs: ApiSong[]
    currentSong: ApiSong | null
    onSongSelect: (song: ApiSong) => void
}

function HomePage({songs, currentSong, onSongSelect}: HomePageProps){
    return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <SongList
      songs={songs}
      currentSong={currentSong}
      onSongSelect={onSongSelect}
      />
    </main>

    )
}

export default HomePage;