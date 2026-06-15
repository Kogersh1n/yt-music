// src/components/Player.tsx
import {useState, useEffect} from 'react';
import type { PlayingSong } from '../types/song.ts';

interface PlayerProps {
    currentSong: PlayingSong | null
    togglePlay: () => void
    isPlaying: boolean
    audioRef: React.RefObject<HTMLAudioElement | null>

}

const formatTime = (time: number) => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)

  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

function Player({currentSong, togglePlay, isPlaying, audioRef}: PlayerProps){
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [volume, setVolume] = useState(0.5);

    useEffect (() => {
      const audio = audioRef.current;
      if (!audio) return;

      const handleTimeUpdate = () => {
          setCurrentTime(audio.currentTime);
      };

      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);

      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    },[currentSong, audioRef]

  )
    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newTime = parseFloat(e.target.value);

          if (audioRef.current) {
            audioRef.current.currentTime = newTime;

            setCurrentTime(newTime);
          };

      }
    
      const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);

        setVolume(newVolume);

        if (audioRef.current) {
          audioRef.current.volume = newVolume;
        }
      }


    return (
    <footer className="h-24 bg-zinc-900 border-t flex items-center justify-center px-6 sticky bottom-0 select-none">
        {currentSong ? (
          <>
          {/* Left Side */}
            <div className="w-[120px]  flex justify-start items-center shrink-0">
              <button onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:scale-105 active:scale-95 transition-transform font-bold text-lg">
                {isPlaying ? '||': '▶'}
              </button>

              <img 
                src={currentSong.cover_url || "https://placehold.co/150x150?text=No+Cover"} 
                alt={currentSong.title}
                className="w-12 h-12 rounded object-cover flex-shrink-0 bg-zinc-800 border border-zinc-800"
              />
            </div>

          {/* Central part */}
            <div className="w-[500px] mx-auto flex flex-col items-center gap-2 px-4 shrink-0">
              <div className="text-center min-w-0">
                  <p className="font-semibold text-sm text-zinc-100 truncate">Сейчас играет {currentSong.title}</p>
                  <p className="text-xs text-zinc-400 truncate">Исполнитель: {currentSong.author}</p>
              </div>

            {/* Slider Part */}

              <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-mono">
                  <span className="shrink-0">{formatTime(currentTime)}</span>

                  <input
                      type='range'
                      min={0}
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleTimeChange}
                      className="w-full custom-slider h-4 bg-transparent appearance-none cursor-pointer"
                  />
                <span className="shrink-0">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Side with adjust volume */}
            <div className="w-[120px] flex justify-end items-center gap-2 shrink-0 text-zinc-400">
                <input 
                    type='range'
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={handleVolumeChange}
                    className='w-20 custom-slider h-4 bg-transparent appearance-none cursor-pointer'
                />
            </div>
          </>


        ) : (
          <>
            <p className="text-sm font-medium text-zinc-300">Здесь будет плеер...</p>
            <p className="text-xs text-zinc-500 mt-1">Ожидает выбора трека</p>
          </>
        
        )
      }

    </footer>
    );
}

export default Player;