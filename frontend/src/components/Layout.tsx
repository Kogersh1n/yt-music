import {Outlet} from 'react-router-dom'
import type { PlayingSong } from '../types/song.ts';

import Header from './Header.tsx'
import Sidebar from './Sidebar.tsx'
import Player from './Player.tsx'



interface LayoutProps {
    isPlaying: boolean
    currentSong: PlayingSong | null
    togglePlay: () => void
    audioRef: React.RefObject<HTMLAudioElement | null>;
}

function Layout({isPlaying, currentSong, togglePlay, audioRef}: LayoutProps){
    return (
        <div className='h-screen flex flex-col bg-zinc-950 text-white'>
            <Header />

            <div className="flex flex-1 overflow-hidden">
            {/* Боковое меню всегда слева */}
                <Sidebar />
        
            {/* Центральный контент — тут страницы будут сменять друг друга */}
                
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet /> {/* Сюда React Router вставит HomePage, SearchPage или LibraryPage */}
                </main>
            </div>
        

            <Player
                currentSong={currentSong}
                togglePlay={togglePlay}
                isPlaying={isPlaying}
                audioRef={audioRef}
            />

        </div>

    )
}


export default Layout;