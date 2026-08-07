import axios from 'axios';

const authClient = axios.create({
  baseURL: 'https://204.168.249.86:8443/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface AuthSessionResponse {
  token: string;
  refreshToken?: string;
  userId?: string;
  username?: string;
  fullName?: string;
  roles?: string[];
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSessionResponse> {
  const { data } = await authClient.post<AuthSessionResponse>('/auth/refresh', { refreshToken });
  return data;
}

export async function logoutAuthSession(refreshToken: string): Promise<void> {
  await authClient.post('/auth/logout', { refreshToken });
}
