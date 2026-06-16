import { useState } from 'react';
import { searchYouTube, type YouTubeResult } from '../api/songs';
import { useSongs } from '../features/songs/useSong';

export default function SearchPage() {
  const [ query, setQuery ] = useState('');
  const [ results, setResults ] = useState<YouTubeResult[]>([]);
  const [ isSearching, setIsSearching ] = useState(false);

  const { importTrack } = useSongs();
  const [downloadingId, setDownloadingId ] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const data = await searchYouTube(query);
      setResults(data.results);
    } catch (err) {
      console.error('Ошибка поиска:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (track: YouTubeResult) => {
    setDownloadingId(track.song_id);
    try {
      // Отправляем прямую ссылку на YouTube-видео в наш инкубатор бэкенда
      await importTrack(track.url);
    } catch (err) {
      console.error('Ошибка скачивания:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="max-w-6xl mx-auto pt-6 px-4 text-white pb-32">

        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-10">
            <div className="relative flex items-center">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Введите название песни, автора или ссылку с YouTube..."
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 rounded-full py-3 pl-5 pr-14 text-sm outline-none transition-colors"
            />
            <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="absolute right-2 px-4 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-800 text-xs font-semibold rounded-full transition-colors"
            >
                {isSearching ? 'Ищу...' : 'Поиск'}
            </button>
            </div>
        </form>

        {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((track) => {
            const isDownloading = downloadingId === track.song_id;
            
            return (
              <div 
                key={track.song_id} 
                className="flex items-center justify-between p-2 hover:bg-zinc-900/60 rounded-lg group transition-colors border border-transparent hover:border-zinc-900"
              >
                {/* Инфо о треке */}
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={track.cover} 
                    alt={track.title} 
                    className="w-14 h-14 object-cover rounded-md flex-shrink-0 bg-zinc-800"
                  />
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate pr-2">{track.title}</h3>
                    <p className="text-xs text-zinc-400 truncate pr-2">{track.author || 'Неизвестен'}</p>
                    <span className="text-[10px] text-zinc-500 font-mono">{formatDuration(track.duration)}</span>
                  </div>
                </div>

                {/* Действия (Кнопки) */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(track)}
                    disabled={isDownloading}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 text-zinc-300 disabled:text-zinc-600 rounded-full transition-colors"
                    title="Скачать в медиатеку"
                  >
                    {isDownloading ? (
                      <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                    ) : (
                      // Иконка стрелочки вниз (Скачать)
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Пустая заглушка
        !isSearching && (
          <div className="text-center py-20 text-zinc-500">
            <span className="text-4xl block mb-2">🔍</span>
            <p className="text-sm">Найдите треки на YouTube и соберите свою коллекцию</p>
          </div>
        )
      )}
      


    </div>
  );
}
