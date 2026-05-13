import { API_PATHS } from '@/lib/api/api-base-urls';
import { apiGet, apiPost } from '@/lib/api/axios-request-handler';

export type IntegrationProvider =
  | 'zoom'
  | 'google'
  | 'google_meet'
  | 'google_workspace'
  | 'facebook'
  | 'linkedin'
  | 'calendly'
  | 'whatsapp'
  | 'slack';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export type IntegrationDefinition = {
  provider: IntegrationProvider;
  name: string;
  tagline: string;
  description: string;
  scopes: string[];
  webhookSupport: boolean;
  syncLabel: string;
};

export type IntegrationConnection = {
  id: string | null;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connected: boolean;
  lastSyncAt: string | null;
  expiresAt: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  error: string | null;
  updatedAt: string | null;
};

export type IntegrationsListResponse = {
  integrations: IntegrationConnection[];
  definitions: IntegrationDefinition[];
};

export type IntegrationConnectResponse = {
  authorizationUrl: string;
};

export function fetchIntegrationsApi(): Promise<IntegrationsListResponse> {
  return apiGet<IntegrationsListResponse>(API_PATHS.integrations.list);
}

export function getIntegrationConnectUrlApi(provider: IntegrationProvider): Promise<IntegrationConnectResponse> {
  return apiGet<IntegrationConnectResponse>(API_PATHS.integrations.connect(provider));
}

export function disconnectIntegrationApi(provider: IntegrationProvider): Promise<{ message: string }> {
  return apiPost(API_PATHS.integrations.disconnect(provider), {});
}

export function syncIntegrationApi(provider: IntegrationProvider): Promise<{ message: string; lastSyncAt: string }> {
  return apiPost(API_PATHS.integrations.sync(provider), {});
}
