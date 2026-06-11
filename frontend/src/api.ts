import axios from 'axios';

// Get backend API URL from env or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
});

// Interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('think_type_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const authApi = {
  loginGuest: async (username: string, avatar?: string) => {
    const response = await apiClient.post('/auth/guest-login', { username, avatar });
    return response.data; // { access_token, token_type }
  },
};

export const gamesApi = {
  createGame: async (totalRounds: number, excludeU: boolean, roundDuration: number = 15) => {
    const response = await apiClient.post('/games/create', {
      total_rounds: totalRounds,
      exclude_u: excludeU,
      round_duration: roundDuration,
    });
    return response.data;
  },
  joinGame: async (roomCode: string) => {
    const response = await apiClient.post(`/games/join/${roomCode.toUpperCase()}`);
    return response.data;
  },
  getGameState: async (roomCode: string) => {
    const response = await apiClient.get(`/games/state/${roomCode.toUpperCase()}`);
    return response.data;
  },
  adminUpdatePoints: async (updates: { submission_id: string; points: number }[]) => {
    const response = await apiClient.patch('/games/admin/update-points', { updates });
    return response.data;
  },
};
