import React from 'react';
import { Play, Sparkles, Flame, Music, RefreshCw } from 'lucide-react';
import { useSongs } from '../features/songs/useSongs';
import { SongCard } from '../components/songs/SongCard';
import { SongRow } from '../components/songs/SongRow';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';
import { usePlayer } from '../context/PlayerContext';

export const HomePage: React.FC = () => {
  const { songs, isLoading, error, refresh, hasMore, loadNextPage } = useSongs();
  const { playSong } = usePlayer();

  if (isLoading && songs.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center">
        <Spinner size="lg" label="Загружаем ваши музыкальные подборки..." />
      </div>
    );
  }

  if (error && songs.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Не удалось подключиться к серверу</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{error}</p>
        <Button variant="primary" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Попробовать снова
        </Button>
      </div>
    );
  }

  const featuredSongs = songs.slice(0, 6);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10">
      <section className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-r from-violet-900/40 via-pink-900/20 to-zinc-900 border border-violet-500/20 shadow-2xl">
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Добро пожаловать
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Слушайте треки в отличном качестве и стримьте с YouTube
          </h1>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Минималистичный плеер с поддержкой глобальной библиотеки, персональной медиатеки и онлайн конвертацией треков.
          </p>
          {featuredSongs.length > 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={() => playSong(featuredSongs[0], songs)}
              className="gap-2 font-semibold"
            >
              <Play className="w-4 h-4 fill-current" /> Быстрый старт
            </Button>
          )}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pink-500 via-violet-600 to-transparent pointer-events-none" />
      </section>

      {featuredSongs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-pink-500" /> Рекомендуем послушать
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {featuredSongs.map((song) => (
              <SongCard key={song.id} song={song} playlistContext={songs} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <Music className="w-5 h-5 text-violet-400" /> Все треки в медиатеке ({songs.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={refresh} className="text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </Button>
        </div>

        {songs.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/60 text-zinc-500">
            В медиатеке пока нет треков. Импортируйте свой первый трек с YouTube!
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-2 space-y-1">
            {songs.map((song, index) => (
              <SongRow key={song.id} song={song} index={index} playlistContext={songs} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" size="sm" onClick={loadNextPage} isLoading={isLoading}>
              Загрузить ещё треки
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;