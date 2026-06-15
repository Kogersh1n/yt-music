import type { ApiSong } from '../api/songs.ts'
import SongList from '../components/SongList.tsx'


interface HomePageProps {
    songs: ApiSong[]
    currentSong: ApiSong | null
    onSongSelect: (song: ApiSong) => void
}

function HomePage({songs, currentSong, onSongSelect}: HomePageProps){
    return (
    <section>
        <SongList
      songs={songs}
      currentSong={currentSong}
      onSongSelect={onSongSelect}
      />
    </section>

    )
}

export default HomePage;