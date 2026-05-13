'use client';

import {
  CalendarDays,
  Clock3,
  Hash,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  SlidersHorizontal,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegrationConnection, IntegrationDefinition, IntegrationProvider } from '@/services/integrations.service';

type IntegrationCardProps = {
  definition: IntegrationDefinition;
  connection: IntegrationConnection;
  busyAction: 'connect' | 'disconnect' | 'sync' | null;
  onConnect: (provider: IntegrationProvider) => void;
  onDisconnect: (provider: IntegrationProvider) => void;
  onSync: (provider: IntegrationProvider) => void;
};

const providerTheme: Record<IntegrationProvider, { iconClass: string; icon?: typeof Video; logoText?: string }> = {
  zoom: {
    icon: Video,
    iconClass: 'bg-[#2d8cff] text-white',
  },
  google: {
    icon: CalendarDays,
    iconClass: 'bg-white text-[#1a73e8]',
  },
  google_meet: {
    icon: Video,
    iconClass: 'bg-white text-[#0f9d58]',
  },
  google_workspace: {
    logoText: 'G',
    iconClass: 'bg-white text-[#4285f4]',
  },
  facebook: {
    logoText: 'f',
    iconClass: 'bg-[#1877f2] text-white',
  },
  linkedin: {
    logoText: 'in',
    iconClass: 'bg-[#0a66c2] text-white',
  },
  calendly: {
    icon: Clock3,
    iconClass: 'bg-white text-[#006bff]',
  },
  whatsapp: {
    icon: MessageCircle,
    iconClass: 'bg-[#25d366] text-white',
  },
  slack: {
    icon: Hash,
    iconClass: 'bg-white text-[#611f69]',
  },
};

function cardDescription(definition: IntegrationDefinition): string {
  const descriptions: Record<IntegrationProvider, string> = {
    zoom: 'Connect Zoom meetings to your CRM, sync recordings, participants, and webinar activity.',
    google: 'Connect your Google Calendar account to create Meet links and sync events across your workflow.',
    google_meet: 'Generate Google Meet links through Google Calendar events and attach them to CRM activity.',
    google_workspace: 'Connect your Google account to access Drive, Sheets, Gmail, Analytics, and workspace data.',
    facebook: 'Auto-sync ad leads, manage DMs, and handle reviews and comments across your Facebook pages.',
    linkedin: 'Connect to get leads from your LinkedIn lead generation ads directly into your CRM.',
    calendly: 'Connect Calendly to sync booking events, invitees, cancellations, and webhook updates.',
    whatsapp: 'Integrate WhatsApp Business to connect with customers and automate messaging workflows.',
    slack: 'Connect Slack for team communication, notifications, workspace events, and channel updates.',
  };
  return descriptions[definition.provider] ?? definition.description;
}

export function IntegrationCard({
  definition,
  connection,
  busyAction,
  onConnect,
  onDisconnect,
  onSync,
}: IntegrationCardProps) {
  const theme = providerTheme[definition.provider];
  const ProviderIcon = theme.icon;
  const connected = connection.connected;
  const busy = busyAction !== null;

  return (
    <article className="overflow-hidden rounded-[5px] border border-[#dfe4ea] bg-white shadow-[0_1px_5px_rgba(15,23,42,0.12)] transition hover:shadow-[0_4px_12px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-950">
      <header className="flex h-[84px] items-center justify-between border-b border-[#eef0f3] px-5 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-4">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', theme.iconClass)}>
            {ProviderIcon ? (
              <ProviderIcon className="h-7 w-7" aria-hidden />
            ) : (
              <span className="text-[26px] font-black leading-none">{theme.logoText}</span>
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-semibold leading-6 text-[#18202a] dark:text-slate-50">{definition.name}</h3>
            {connected ? (
              <p className="mt-1 truncate text-[13px] leading-5 text-[#227a64] dark:text-emerald-300">Connected</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (connected) onDisconnect(definition.provider);
          }}
          className="rounded-md p-1 text-[#89919c] transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          aria-label={`${definition.name} options`}
        >
          {busyAction === 'disconnect' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MoreVertical className="h-5 w-5" />}
        </button>
      </header>

      <div className="flex min-h-[112px] items-start border-b border-[#eef0f3] px-5 py-4 dark:border-slate-800">
        <p className="line-clamp-3 text-[16px] leading-[1.45] text-[#2b3138] dark:text-slate-200">{cardDescription(definition)}</p>
      </div>

      <footer className="px-5 py-4">
        {connected ? (
          <button
            type="button"
            onClick={() => onSync(definition.provider)}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[4px] border border-[#b7e2cf] bg-white text-[15px] font-semibold text-[#17835f] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            {busyAction === 'sync' ? <Loader2 className="h-5 w-5 animate-spin" /> : <SlidersHorizontal className="h-5 w-5" />}
            Manage
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(definition.provider)}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[4px] border border-[#aebdca] bg-white text-[15px] font-semibold text-[#0f61a8] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950/30"
          >
            {busyAction === 'connect' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
            Connect
          </button>
        )}
      </footer>
    </article>
  );
}
