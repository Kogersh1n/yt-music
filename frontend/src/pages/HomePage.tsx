import SongList from '../components/SongList.tsx'

interface Song {
    id: number
    title: string
    author: string
    url: string
}

interface HomePageProps {
    songs: Song[]
    currentSong: Song | null
    onSongSelect: (song: Song) => void
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