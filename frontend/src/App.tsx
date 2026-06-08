import './App.css'
import {useState, useEffect, useRef} from 'react' 
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import {useSongs} from './features/songs/useSong.ts'


import Layout from './components/Layout.tsx';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';

interface Song {
  id: number;
  title: string;
  author: string;
  url: string;
}

function App() {
  const { songs, isLoading, error } = useSongs();
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
  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        {/* Красивый крутящийся спиннер на Tailwind */}
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-pink-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-400 tracking-wide animate-pulse">
          Устанавливаем соединение с FastAPI...
        </p>
      </div>
    );
  }

  // 3. ВТОРАЯ ПРОВЕРКА: Промис в состоянии Rejected (сервер выключен, упал или выдал 500)
  if (error) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4 p-4 text-center">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-xl font-bold text-red-500">Ошибка подключения к бэкенду</h2>
        {/* Выводим точный текст ошибки, который поймал apiClient */}
        <p className="text-sm text-zinc-400 bg-zinc-900 px-4 py-2 rounded border border-zinc-800 max-w-md font-mono">
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold rounded-lg transition-colors"
        >
          Попробуйте обновить страницу
        </button>
      </div>
    );
  }



  return (
      <BrowserRouter>
        <Routes>
          <Route 
            element={
              <Layout 
                isPlaying={isPlaying}
                currentSong={currentSong}
                togglePlay={togglePlay}
              />
            }
          >

            <Route 
              index 
              element={
                <HomePage 
                  songs={songs} 
                  currentSong={currentSong} 
                  onSongSelect={setCurrentSong} 
                />
              } 
            />

            <Route path="search" element={<SearchPage />} />

            <Route path="library" element={<LibraryPage />} />



          </Route>
        </Routes>
        <audio ref={audioRef} src={currentSong?.url}/>
      </BrowserRouter>

  )


}
export default App
