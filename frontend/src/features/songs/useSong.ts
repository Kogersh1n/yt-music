import {useState, useEffect, useCallback} from 'react';
import {loadSongs, importSongFromYoutube, type ApiSong} from '../../api/songs';

// import { MOCK_SONGS } from '../../mockData.ts';


export function useSongs() {
    const [songs, setSongs] = useState<ApiSong[]>([]);    
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // states for infinity scrolling
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(false);

    const fetchSongs = useCallback(async (currentCursor?: string | null) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await loadSongs(currentCursor)

            setSongs(data.items);
            setCursor(data.next_cursor);
            setHasMore(data.has_more);            
        } catch (err: any) {
            setError(err.message || 'Can not load songs')
        } finally {
            setIsLoading(false);
        }
    }, []);

    const importTrack = async (query: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await importSongFromYoutube(query);

            await fetchSongs();
        } catch (err: any) {
            setError(err.message || 'Error with import');
            setIsLoading(false);
        }
    };

    useEffect (() => {
        fetchSongs();

    }, [fetchSongs]);

    return {
        songs,
        isLoading,
        error,
        importTrack,
        hasMore,
        load_more: () => hasMore && fetchSongs(cursor),
    };


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

}