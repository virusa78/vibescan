import { api } from '../client/utils/api';

export type ApiKeyUsagePoint = {
  date: string;
  count: number;
};

export type ApiKeyDetailsResponse = {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  request_count: number;
  usage_by_day: ApiKeyUsagePoint[];
  status: 'active' | 'revoked' | 'expired';
};

export async function getApiKeyDetails(keyId: string): Promise<ApiKeyDetailsResponse> {
  const response = await api.get<ApiKeyDetailsResponse>(`/api/v1/api-keys/${keyId}`);
  return response.data;
}
