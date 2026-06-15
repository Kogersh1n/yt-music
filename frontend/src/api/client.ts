const BASE_URL = 'http://localhost:8000';

/**
* @param endpoint какая то специальная функция для апи 
* @param options дополнительные настройки запроса
*/

export async function apiClient<T>(endpoint: string, options?: RequestInit ): Promise<T>{
    try{
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        
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

