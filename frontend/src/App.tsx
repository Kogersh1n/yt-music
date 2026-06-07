import './App.css'
import {useState, useEffect, useRef} from 'react' 
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import {MOCK_SONGS} from './mockData.ts'

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
