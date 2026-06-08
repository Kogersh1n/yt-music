import {useState, useEffect} from 'react';
import {loadSongs} from '../../api/songs';

import { MOCK_SONGS } from '../../mockData.ts';

export interface Song {
    id: number;
    title: string;
    author: string;
    url: string;
}

export function useSongs() {
    const [songs, setSongs] = useState(MOCK_SONGS);
    
    // const [isLoading, setIsLoading] = useState(true);
    
    // const [error, setError] = useState<string | null>(null);

    const [isLoading] = useState(false);
    const [error] = useState<string | null>(null);

    // useEffect(() => {
    //     async function fetchSongs() {
    //         try {
    //             setIsLoading(false);
    //             setError(null);

    //             const data = await loadSongs(); // loadSongs return massive of songs from api
                
    //             setSongs(data); // then we store then into state
                
            
    //         }catch (err: any) {
    //             setError(err.message || 'Cant load songs');
    //         }
    //         finally {
    //             setIsLoading(false);
    //         };
    //     }
    //     fetchSongs();

    // }, []);

    return  {songs, isLoading, error};
}