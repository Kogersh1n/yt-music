import {Outlet} from 'react-router-dom'

import Header from './Header.tsx'
import Sidebar from './Sidebar.tsx'
import Player from './Player.tsx'

interface Song {
    id: number;
    title: string;
    author: string;
    url: string;
}

interface LayoutProps {
    isPlaying: boolean
    currentSong: Song | null
    togglePlay: () => void
}

function Layout({isPlaying, currentSong, togglePlay}: LayoutProps){
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
            />

        </div>

    )
}


export default Layout;