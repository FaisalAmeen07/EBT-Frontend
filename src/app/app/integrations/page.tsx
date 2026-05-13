'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { AlertTriangle, Search } from 'lucide-react';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  disconnectIntegrationApi,
  fetchIntegrationsApi,
  getIntegrationConnectUrlApi,
  syncIntegrationApi,
  type IntegrationConnection,
  type IntegrationDefinition,
  type IntegrationProvider,
} from '@/services/integrations.service';

const FALLBACK_DEFINITIONS: IntegrationDefinition[] = [
  {
    provider: 'google',
    name: 'Google Calendar',
    tagline: 'Calendar events and Google Meet links',
    description: 'Connect your Google Calendar account to create Meet links and sync events across your workflow.',
    scopes: ['calendar.events', 'calendar.readonly', 'meet.links'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
  {
    provider: 'google_meet',
    name: 'Google Meet',
    tagline: 'Meeting links through Google Calendar',
    description: 'Generate Google Meet links through Google Calendar events and attach them to CRM activity.',
    scopes: ['calendar.events', 'conferenceData', 'meet.links'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
  {
    provider: 'linkedin',
    name: 'LinkedIn',
    tagline: 'Lead generation ads',
    description: 'Connect to get leads from your LinkedIn lead generation ads directly into your CRM.',
    scopes: ['r_ads', 'r_liteprofile', 'r_organization_social'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
  {
    provider: 'zoom',
    name: 'Zoom',
    tagline: 'Video meetings and webinar sync',
    description: 'Connect Zoom meetings to your CRM, sync recordings, participants, and webinar activity.',
    scopes: ['meeting:write', 'meeting:read', 'webinar:read'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
  {
    provider: 'whatsapp',
    name: 'WhatsApp',
    tagline: 'Business messaging and automation',
    description: 'Integrate WhatsApp Business to connect with customers and automate messaging workflows.',
    scopes: ['messages', 'templates', 'contacts'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
  {
    provider: 'slack',
    name: 'Slack',
    tagline: 'Team communication and notifications',
    description: 'Connect Slack for team communication, notifications, workspace events, and channel updates.',
    scopes: ['channels:read', 'chat:write', 'users:read'],
    webhookSupport: true,
    syncLabel: 'Manage',
  },
];

const REMOVED_PROVIDERS = new Set<IntegrationProvider>(['google_workspace', 'facebook', 'calendly']);

function mergeDefinitions(apiDefinitions: IntegrationDefinition[]): IntegrationDefinition[] {
  const byProvider = new Map<IntegrationProvider, IntegrationDefinition>();
  for (const definition of apiDefinitions) {
    if (!REMOVED_PROVIDERS.has(definition.provider)) byProvider.set(definition.provider, definition);
  }
  for (const definition of FALLBACK_DEFINITIONS) {
    if (!byProvider.has(definition.provider)) byProvider.set(definition.provider, definition);
  }
  const order = new Map(FALLBACK_DEFINITIONS.map((definition, index) => [definition.provider, index]));
  return [...byProvider.values()].sort((a, b) => (order.get(a.provider) ?? 999) - (order.get(b.provider) ?? 999));
}

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data) return String(data.message);
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function emptyConnection(provider: IntegrationProvider): IntegrationConnection {
  return {
    id: null,
    provider,
    status: 'disconnected',
    connected: false,
    lastSyncAt: null,
    expiresAt: null,
    scopes: [],
    metadata: {},
    error: null,
    updatedAt: null,
  };
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="h-[216px] animate-pulse rounded-[5px] border border-[#dfe4ea] bg-white shadow-[0_1px_5px_rgba(15,23,42,0.1)] dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="flex h-[84px] items-center gap-4 border-b border-[#eef0f3] px-5 dark:border-slate-800">
            <div className="h-10 w-10 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-2 border-b border-[#eef0f3] px-5 py-4 dark:border-slate-800">
            <div className="h-4 rounded bg-slate-100 dark:bg-slate-900" />
            <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-900" />
            <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-900" />
          </div>
          <div className="px-5 py-4">
            <div className="h-11 rounded bg-slate-100 dark:bg-slate-900" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppIntegrationsPage() {
  const [definitions, setDefinitions] = useState<IntegrationDefinition[]>(FALLBACK_DEFINITIONS);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'connect' | 'disconnect' | 'sync' | null>>({});

  async function loadIntegrations() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchIntegrationsApi();
      setDefinitions(mergeDefinitions(data.definitions));
      setConnections(data.integrations);
    } catch (error) {
      setDefinitions(FALLBACK_DEFINITIONS);
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  const connectionByProvider = useMemo(() => {
    const map = new Map<IntegrationProvider, IntegrationConnection>();
    for (const connection of connections) map.set(connection.provider, connection);
    return map;
  }, [connections]);

  const visibleDefinitions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return definitions;
    return definitions.filter((definition) =>
      [definition.name, definition.tagline, definition.description, ...definition.scopes]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [definitions, query]);

  const runAction = async (provider: IntegrationProvider, action: 'connect' | 'disconnect' | 'sync') => {
    setBusy((state) => ({ ...state, [provider]: action }));
    try {
      if (action === 'connect') {
        const { authorizationUrl } = await getIntegrationConnectUrlApi(provider);
        toast('Redirecting to provider authorization...', 'info');
        window.location.href = authorizationUrl;
        return;
      }

      if (action === 'disconnect') {
        await disconnectIntegrationApi(provider);
        toast('Integration disconnected.', 'success');
      } else {
        await syncIntegrationApi(provider);
        toast('Integration sync started.', 'success');
      }

      await loadIntegrations();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy((state) => ({ ...state, [provider]: null }));
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex justify-end">
        <div className="relative w-full max-w-[430px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-[#334155] dark:text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Integrations"
            className="h-[52px] w-full rounded-[6px] border border-[#d9dee5] bg-white pl-10 pr-4 text-[18px] text-[#2b3138] outline-none transition placeholder:text-[#6b7280] focus:border-[#9db3c8] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950/40"
          />
        </div>
      </div>

      {loadError ? (
        <div className="flex items-center gap-2 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Backend integrations API is not available, showing preview cards.
        </div>
      ) : null}

      {loading ? <LoadingGrid /> : null}

      {!loading && visibleDefinitions.length === 0 ? (
        <section className="rounded-[5px] border border-[#dfe4ea] bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-950">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">No integrations found</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try another search term.</p>
        </section>
      ) : null}

      {!loading && visibleDefinitions.length > 0 ? (
        <section className={cn('grid gap-5 sm:grid-cols-2 xl:grid-cols-3')}>
          {visibleDefinitions.map((definition) => {
            const connection = connectionByProvider.get(definition.provider) ?? emptyConnection(definition.provider);
            return (
              <IntegrationCard
                key={definition.provider}
                definition={definition}
                connection={connection}
                busyAction={busy[definition.provider] ?? null}
                onConnect={(provider) => void runAction(provider, 'connect')}
                onDisconnect={(provider) => void runAction(provider, 'disconnect')}
                onSync={(provider) => void runAction(provider, 'sync')}
              />
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
