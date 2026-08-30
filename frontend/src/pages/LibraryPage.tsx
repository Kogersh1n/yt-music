import React, { useState } from 'react';
import { Library, Heart, Music, PlusCircle, RefreshCw } from 'lucide-react';
import { useSongs } from '../features/songs/useSongs';
import { SongRow } from '../components/songs/SongRow';
import { Spinner } from '../components/common/Spinner';
import { Button } from '../components/common/Button';
import { ImportModal } from '../components/songs/ImportModal';

export const LibraryPage: React.FC = () => {
  const { songs, isLoading, refresh } = useSongs();
  const [filter, setFilter] = useState<'all' | 'liked'>('all');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const displayedSongs = filter === 'liked' ? songs.filter((s) => s.liked) : songs;

  const handleDeleted = () => {
    refresh();
  };

  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Library className="w-7 h-7 text-pink-500" /> Моя медиатека
            </h1>
            <p className="text-xs text-zinc-400">Ваша коллекция загруженных и понравившихся треков</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Обновить
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              className="gap-2 text-xs"
            >
              <PlusCircle className="w-4 h-4" /> Добавить трек
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              filter === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" /> Все треки ({songs.length})
          </button>
          <button
            onClick={() => setFilter('liked')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              filter === 'liked'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-pink-500" /> Понравившиеся ({songs.filter((s) => s.liked).length})
          </button>
        </div>

        {/* Content */}
        {isLoading && songs.length === 0 ? (
          <div className="py-16 flex justify-center">
            <Spinner size="lg" label="Загружаем медиатеку..." />
          </div>
        ) : displayedSongs.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-2xl space-y-3">
            <Music className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">
              {filter === 'liked' ? 'У вас нет понравившихся треков' : 'Медиатека пуста'}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {filter === 'liked'
                ? 'Ставьте сердечки на треки во время прослушивания, чтобы они появились здесь.'
                : 'Импортируйте треки с YouTube или найдите их через поиск.'}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-2 space-y-1">
            {displayedSongs.map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                playlistContext={displayedSongs}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={refresh} />
    </>
  );
};

export default LibraryPage;