const BASE_URL = 'http://localhost:8000';

/**
* @param endpoint какая то специальная функция для апи 
*/

export async function apiClient<T>(endpoint: string): Promise<T>{
    try{
        const response = await fetch(`${BASE_URL}${endpoint}`);
        
        if (!response.ok){
            throw new Error(`HTTP error ${response.status}`)
        }

        const data = await response.json();
        return data as T;
    } catch (error) {
        console.error('API Client Error:', error);
        throw error;
    }
    

}

