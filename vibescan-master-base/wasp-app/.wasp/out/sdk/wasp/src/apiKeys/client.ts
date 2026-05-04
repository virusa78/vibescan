import { getAPIKeyDetails as getAPIKeyDetailsOperation } from 'wasp/client/operations';

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
  return await getAPIKeyDetailsOperation({ keyId });
}
