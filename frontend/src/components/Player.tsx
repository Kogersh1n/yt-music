// src/components/Player.tsx


interface Song {
    id: number
    title: string
    author: string
    url: string
}

interface PlayerProps {
    currentSong: Song | null
    togglePlay: () => void
    isPlaying: boolean
}

function Player({currentSong, togglePlay, isPlaying}: PlayerProps){
    return (
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

    </footer>
    );
}

export default Player;