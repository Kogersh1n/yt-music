import { useState, useEffect } from 'react';
import type { ApiSong} from "../api/songs";
import { getSongCover } from "../api/songs";

// src/components/SongCard.tsx


interface SongCardProps {
  song: ApiSong;
  isActive: boolean;
  onClick: () => void;
}


function SongCard ({song, isActive, onClick}: SongCardProps){
    const [coverUrl, setCoverUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getSongCover(song.id)
            .then((data) => {
                if (!cancelled) setCoverUrl(data.cover_url);
            })
            .catch(() => { /* cover не критичен */ });
        return () => { cancelled = true; };
    }, [song.id]);


    return (
          <button
        type="button"
         className={`flex items-center gap-4 p-3 group rounded-lg transition-colors 
           ${isActive ? 'bg-zinc-800 border border-pink-600' : 'bg-zinc-900 hover:bg-zinc-800'}
         `}
         onClick={() => onClick()}
         >
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt={song.title}
              className="w-12 h-12 rounded flex-shrink-0 object-cover bg-zinc-700"
            />
          ) : (
            <div className="w-12 h-12 bg-zinc-700 rounded flex-shrink-0" />
          )}
           <div className="flex-1 min-w-0">
             <h3 className="font-medium text-zinc-100 truncate">{song.title}</h3>
             <p className="text-sm text-zinc-400 truncate">{song.author}</p>
           </div>
        </button>
     );
 }
      

export default SongCard;
