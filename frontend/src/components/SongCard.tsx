import type { ApiSong } from "../api/songs";

// src/components/SongCard.tsx


interface SongCardProps {
  song: ApiSong;
  isActive: boolean;
  onClick: () => void;
}


function SongCard ({song, isActive, onClick}: SongCardProps){
    return (
        <div 
        className={`flex items-center gap-4 p-3 group rounded-lg transition-colors 
          ${isActive ? 'bg-zinc-800 border border-pink-600' : 'bg-zinc-900 hover:bg-zinc-800'}
        `}
        onClick={() => onClick()}
        >
        
          
          <div className="w-12 h-12 bg-zinc-700 rounded flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-100 truncate">{song.title}</h3>
            <p className="text-sm text-zinc-400 truncate">{song.author}</p>
            {/* <button onClick={() => setCurrentSong(song)} 
            className="px-4 py-2 bg-white text-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Play</button> */}
          </div>
        </div>
      
    );
    }
    

export default SongCard;
