/** Geliştirmede doğrudan backend; prod'da nginx /api proxy (www ve apex aynı origin). */
export const API_BASE_URL = import.meta.env.DEV
  ? 'https://204.168.249.86:8443/api'
  : '/api';

/** SignalR hub kökü — prod'da göreli yol. */
export function getHubBaseUrl(hubPath: string): string {
  if (API_BASE_URL.startsWith('/')) {
    return hubPath.startsWith('/') ? hubPath : `/${hubPath}`;
  }
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const path = hubPath.startsWith('/') ? hubPath : `/${hubPath}`;
  return `${origin}${path}`;
}
