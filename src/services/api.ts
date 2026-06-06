import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your machine's IP when testing on a physical device
const API_URL = 'http://10.0.2.2:5000/api'; // Android emulator
// const API_URL = 'http://localhost:5000/api'; // iOS simulator

class ApiService {
  private token: string | null = null;

  async setToken(token: string) {
    this.token = token;
    await AsyncStorage.setItem('token', token);
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await AsyncStorage.getItem('token');
    }
    return this.token;
  }

  async clearToken() {
    this.token = null;
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  }

  // Auth
  async register(userData: { name: string; email: string; password: string; department: string }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Profile
  async getProfile() {
    return this.request('/profile');
  }

  async updateProfile(data: Record<string, unknown>) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getProfileById(id: string) {
    return this.request(`/profile/${encodeURIComponent(id)}`);
  }

  // Match / Discover
  async getDiscoverProfiles() {
    return this.request('/match/discover');
  }

  async likeUser(id: string) {
    return this.request(`/match/like/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async dislikeUser(id: string) {
    return this.request(`/match/dislike/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async getMatches() {
    return this.request('/match');
  }

  // Chat
  async getMessages(matchId: string, page = 1) {
    return this.request(`/chat/${encodeURIComponent(matchId)}?page=${page}`);
  }

  async sendMessage(matchId: string, text: string) {
    return this.request(`/chat/${encodeURIComponent(matchId)}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }
}

export default new ApiService();
