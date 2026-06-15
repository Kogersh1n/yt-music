import { useState } from 'react';
import { useSongs } from '../features/songs/useSong.ts'; // Проверь путь к хуку

export default function LibraryPage() {
  const [query, setQuery] = useState('');

  const { importTrack, isLoading, error } = useSongs();

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    await importTrack(query);
    setQuery('');
  };

  return (
    <div className="max-w-2xl mx-auto pt-10 px-4 text-white pb-32">
      <h1 className="text-3xl font-bold mb-2">Медиатека</h1>
      <p className="text-zinc-400 text-sm mb-8">Управляйте своими треками и добавляйте новые аудиозаписи.</p>

      {/* Блок импорта треков */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-2">Импорт треков с YouTube</h2>
        <p className="text-xs text-zinc-400 mb-4">
          Вставьте ссылку на видео или просто введите название песни. Бэкенд автоматически скачает аудио и добавит в облако.
        </p>

        <form onSubmit={handleImport} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder="Например: Ссылка на YouTube или Название трека..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-pink-600 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div>
                <span>Скачивание...</span>
              </>
            ) : (
              <span>Импортировать</span>
            )}
          </button>
        </form>

        {/* Локальный вывод ошибок импорта */}
        {error && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-900/50 text-red-400 text-xs rounded-lg font-mono">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Список локальных плейлистов или треков (на будущее) */}
      <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-zinc-500 text-sm">
        Здесь будут отображаться ваши плейлисты и альбомы.
      </div>
    </div>
  );
}