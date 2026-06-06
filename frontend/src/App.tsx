import './App.css'
import {useState, useEffect, useRef} from 'react' 
import {MOCK_SONGS} from './mockData.ts'

import Header from './components/Header.tsx'
import SongList from './components/SongList.tsx'
import Player from './components/Player.tsx'

interface Song {
  id: number;
  title: string;
  author: string;
  url: string;
}

function App() {
  const [songs, setSongs] = useState(MOCK_SONGS)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }


  useEffect(() => {
    if (currentSong && audioRef.current){
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [currentSong]);

  // useEffect(() => {
  //   fetch('http://localhost:8000/songs')
  //   .then(response => response.json())
  //   .then(data => setSongs(data));
  // }, []);


  return (
    <div className='h-screen flex flex-col bg-zinc-950 text-white'>
      <Header />
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <SongList
      songs={songs}
      currentSong={currentSong}
      onSongSelect={setCurrentSong}
      />
    </main>

    <Player
    currentSong={currentSong}
    togglePlay={togglePlay}
    isPlaying={isPlaying}
    />

    <audio ref={audioRef} src={currentSong?.url}/>  
     
    </div>


  )


}
export default App
