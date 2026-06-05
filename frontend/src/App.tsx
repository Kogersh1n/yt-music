import './App.css'
import {useState, useEffect, useRef} from 'react' 
import {MOCK_SONGS} from './mockData.ts'

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
    <header className='p-4 border-b border-zinc-800 bg-zinc-900'> 
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-red-600"> YT </span>Music
      </h1>
    </header>
    
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      {songs.map((song) => {
        return (
        <div key ={song.id} 
        className={`flex items-center gap-4 p-3 group rounded-lg transition-colors 
          ${currentSong?.id === song.id ? 'bg-zinc-800 border border-pink-600' : 'bg-zinc-900 hover:bg-zinc-800'}
        `}
        onClick={() => setCurrentSong(song)}
        >
        
          
          <div className="w-12 h-12 bg-zinc-700 rounded flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-100 truncate">{song.title}</h3>
            <p className="text-sm text-zinc-400 truncate">{song.author}</p>
            {/* <button onClick={() => setCurrentSong(song)} 
            className="px-4 py-2 bg-white text-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Play</button> */}
          </div>
        </div>
      
    );
    })}
    </div>
    </main>

    <footer className="h-24 bg-zinc-900 border-t flex items-center justify-center px-6 sticky bottom-0">
        {currentSong ? (
          <>
            <div className="w-1/4 flex justify-start">
              <button onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:scale-105 active:scale-95 transition-transform font-bold text-lg">
                {isPlaying ? '||': '▶'}
              </button>
            </div>
            <div className="flex-1 text-center min-w-0">
              <p>Сейчас играет {currentSong.title}</p>
              <p>Исполнитель: {currentSong.author}</p>
            </div>

            <div className="w-1/4 flex justify-end">
              {/* Сюда в будущем можно будет добавить, например, ползунок громкости */}
            </div>
          </>


        ) : (
          <>
            <p className="text-sm font-medium text-zinc-300">Здесь будет плеер...</p>
            <p className="text-xs text-zinc-500 mt-1">Ожидает выбора трека</p>
          </>
        
        )
      }
      <audio ref={audioRef} src={currentSong?.url}/>  
    </footer>
     
    </div>


  )


}
export default App
