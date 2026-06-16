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
      {/* Список локальных плейлистов или треков (на будущее) */}
      <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-zinc-500 text-sm">
        Здесь будут отображаться ваши плейлисты и альбомы.
      </div>
    </div>
  );
}