import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Music, Radio } from 'lucide-react';
import { useYouTubeSearch } from '../features/youtube/useYouTube';
import { searchSongs } from '../api/songs';
import type { ApiSong } from '../types/song';
import { SongCard } from '../components/songs/SongCard';
import { SongRow } from '../components/songs/SongRow';
import { Spinner } from '../components/common/Spinner';

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState<'all' | 'local' | 'youtube'>('all');
  const [localResults, setLocalResults] = useState<ApiSong[]>([]);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const { results: ytResults, isLoading: isYtLoading, search: searchYt } = useYouTubeSearch();

  useEffect(() => {
    if (query.trim()) {
      executeSearch(query.trim());
    } else {
      setLocalResults([]);
    }
  }, [query]);

  const executeSearch = async (searchTerm: string) => {
    setIsLocalLoading(true);
    try {
      const localData = await searchSongs(searchTerm);
      setLocalResults(localData || []);
    } catch (err) {
      console.error('Local search error:', err);
    } finally {
      setIsLocalLoading(false);
    }

    searchYt(searchTerm);
  };

  const isLoading = (isLocalLoading || isYtLoading) && !!query;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Query Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-violet-400" />
            {query ? (
              <span>
                Результаты поиска: <span className="text-pink-400">«{query}»</span>
              </span>
            ) : (
              <span>Поиск музыки</span>
            )}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {query
              ? 'Показаны найденные треки в вашей медиатеке и результаты с YouTube'
              : 'Вводите текст в поисковую строку вверху для быстрого поиска'}
          </p>
        </div>

        {/* Tab Filters */}
        {query && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Все ({localResults.length + ytResults.length})
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'local'
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" /> Локальные ({localResults.length})
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-red-400 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube ({ytResults.length})
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 flex justify-center">
          <Spinner size="lg" label="Ищем в медиатеке и на YouTube..." />
        </div>
      )}

      {/* Empty Prompt State */}
      {!query && !isLoading && (
        <div className="py-20 text-center text-zinc-500 space-y-3 bg-zinc-900/20 border border-zinc-800/40 rounded-3xl p-8 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-violet-600/10 text-violet-400 flex items-center justify-center mx-auto mb-2">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200">Введите поисковый запрос</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Используйте единую строку поиска вверху экрана для нахождения исполнителей, локальных файлов или аудио со всех уголков YouTube.
          </p>
        </div>
      )}

      {/* Results Section */}
      {!isLoading && query && (
        <div className="space-y-8">
          {/* Local Results */}
          {(activeTab === 'all' || activeTab === 'local') && localResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Найденные треки в вашей медиатеке
              </h2>
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-2 space-y-1">
                {localResults.map((song, idx) => (
                  <SongRow key={song.id} song={song} index={idx} playlistContext={localResults} />
                ))}
              </div>
            </div>
          )}

          {/* YouTube Stream Results */}
          {(activeTab === 'all' || activeTab === 'youtube') && ytResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Результаты с YouTube (Мгновенный стриминг)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {ytResults.map((item) => (
                  <SongCard
                    key={item.video_id}
                    song={item}
                    playlistContext={ytResults}
                    onImport={() => executeSearch(query)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && localResults.length === 0 && ytResults.length === 0 && (
            <div className="py-16 text-center text-zinc-500 space-y-2">
              <Radio className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-base font-medium text-zinc-400">Ничего не найдено</p>
              <p className="text-xs">Попробуйте изменить запрос в поисковой строке сверху</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
