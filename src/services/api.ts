import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set this to your deployed backend URL when going live
// Replace with your actual Railway URL after deploying
const PRODUCTION_URL = 'https://chrischat-dating-app-for-christ-university-production.up.railway.app';

const getBaseUrl = () => {
  if (PRODUCTION_URL) return PRODUCTION_URL;
  // Local development fallback
  return Platform.OS === 'web' ? 'http://localhost:5000' : 'http://10.4.203.24:5000';
};

const BASE_URL = getBaseUrl();
const API_URL = `${BASE_URL}/api`;

export const SOCKET_URL = BASE_URL;

export const getImageUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
};

// Helper: create a cross-platform FormData entry from an image picker asset URI
export async function appendFileToFormData(
  formData: FormData,
  fieldName: string,
  uri: string,
  fileName: string,
  mimeType: string,
) {
  if (Platform.OS === 'web') {
    // On web, fetch the URI (blob/data URL) and append as a File
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append(fieldName, new File([blob], fileName, { type: mimeType }));
  } else {
    // On native RN, FormData accepts this shape directly
    // (do NOT fetch → blob, RN doesn't support ArrayBuffer blobs in FormData)
    (formData as any).append(fieldName, {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: fileName,
      type: mimeType,
    });
  }
}

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

  private async uploadRequest(endpoint: string, formData: FormData) {
    const token = await this.getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
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

  // E2EE key management
  async uploadPublicKey(publicKey: string) {
    return this.request('/profile/keys/public', {
      method: 'PUT',
      body: JSON.stringify({ publicKey }),
    });
  }

  async getPeerPublicKey(userId: string): Promise<{ publicKey: string }> {
    return this.request(`/profile/keys/${encodeURIComponent(userId)}`);
  }

  async uploadPhotos(formData: FormData) {
    return this.uploadRequest('/profile/photos', formData);
  }

  async deletePhoto(index: number) {
    return this.request(`/profile/photos/${index}`, { method: 'DELETE' });
  }

  async toggleVisibility() {
    return this.request('/profile/visibility', { method: 'POST' });
  }

  async getBadges() {
    return this.request('/profile/badges');
  }

  async blockUser(id: string) {
    return this.request(`/profile/block/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async unblockUser(id: string) {
    return this.request(`/profile/unblock/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async reportUser(id: string, reason: string, description?: string) {
    return this.request(`/profile/report/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    });
  }

  async getBlockedUsers() {
    return this.request('/profile/blocked');
  }

  // Match / Discover
  async getDiscoverProfiles(filters?: {
    department?: string;
    year?: string;
    campus?: string;
    minAge?: number;
    maxAge?: number;
    mode?: string;
  }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== '') params.append(key, String(val));
      });
    }
    const query = params.toString();
    return this.request(`/match/discover${query ? `?${query}` : ''}`);
  }

  async getDailyPick() {
    return this.request('/match/daily-pick');
  }

  async likeUser(id: string) {
    return this.request(`/match/like/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async superLikeUser(id: string) {
    return this.request(`/match/superlike/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async undoSwipe() {
    return this.request('/match/undo', { method: 'POST' });
  }

  async dislikeUser(id: string) {
    return this.request(`/match/dislike/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async getMatches() {
    return this.request('/match');
  }

  async unmatch(matchId: string) {
    return this.request(`/match/unmatch/${encodeURIComponent(matchId)}`, { method: 'POST' });
  }

  async boostProfile() {
    return this.request('/match/boost', { method: 'POST' });
  }

  async getCompatibility(id: string) {
    return this.request(`/match/compatibility/${encodeURIComponent(id)}`);
  }

  // Chat
  async getMessages(matchId: string, page = 1) {
    return this.request(`/chat/${encodeURIComponent(matchId)}?page=${page}`);
  }

  async sendMessage(matchId: string, text: string, encrypted = false) {
    return this.request(`/chat/${encodeURIComponent(matchId)}`, {
      method: 'POST',
      body: JSON.stringify({ text, encrypted }),
    });
  }

  async sendImageMessage(matchId: string, formData: FormData) {
    return this.uploadRequest(`/chat/${encodeURIComponent(matchId)}/image`, formData);
  }

  async sendVideoMessage(matchId: string, formData: FormData) {
    return this.uploadRequest(`/chat/${encodeURIComponent(matchId)}/video`, formData);
  }

  async markMessagesRead(matchId: string) {
    return this.request(`/chat/${encodeURIComponent(matchId)}/read`, { method: 'POST' });
  }

  async getIcebreakers() {
    return this.request('/chat/icebreakers');
  }

  // Events
  async getEvents(filters?: { campus?: string; category?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val);
      });
    }
    const query = params.toString();
    return this.request(`/events${query ? `?${query}` : ''}`);
  }

  async createEvent(data: {
    title: string;
    description: string;
    date: string;
    location: string;
    campus: string;
    category?: string;
  }) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async rsvpEvent(id: string) {
    return this.request(`/events/${encodeURIComponent(id)}/rsvp`, { method: 'POST' });
  }

  async getEventAttendees(id: string) {
    return this.request(`/events/${encodeURIComponent(id)}/attendees`);
  }

  // Confessions
  async getConfessions(page = 1, filters?: { campus?: string; category?: string }) {
    const params = new URLSearchParams({ page: String(page) });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val);
      });
    }
    return this.request(`/confessions?${params.toString()}`);
  }

  async postConfession(data: { text: string; category?: string; campus?: string }) {
    return this.request('/confessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async likeConfession(id: string) {
    return this.request(`/confessions/${encodeURIComponent(id)}/like`, { method: 'POST' });
  }

  async reportConfession(id: string) {
    return this.request(`/confessions/${encodeURIComponent(id)}/report`, { method: 'POST' });
  }
}

export default new ApiService();
