import {
  ArrowLeftIcon,
  CopyIcon,
  GlobeIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShuffleIcon,
  TimerIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { SidePanelProvider, useSidePanel } from '@/app/sidepanel/context.tsx';
import type { SessionSortOption } from '@/app/types.ts';
import type { DomainEntry } from '@/modules/domain/enums.ts';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { CompatibilityLine } from '@/components/compatibility-line.tsx';
import { EmptyState } from '@/components/empty-state.tsx';
import { ErrorState } from '@/components/error-state.tsx';
import { IsolationChip, shouldShowIsolationChip } from '@/components/isolation-chip.tsx';
import { LoadingState } from '@/components/loading-state.tsx';
import { SearchInput } from '@/components/search-input.tsx';
import { SessionList } from '@/components/session-list.tsx';
import { SessionNameDialog } from '@/components/session-name-dialog.tsx';
import { SessionRow } from '@/components/session-row.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { stripSessionMarker } from '@/modules/domain/session-factory.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';

const SORT_LABELS: Record<SessionSortOption, string> = {
  pinned: 'Pinned first',
  name: 'Name',
  lastUsed: 'Last used',
  tabs: 'Tab count',
};

function nextSessionName(existingCount: number): string {
  return `Session ${existingCount + 1}`;
}

function SessionSidebar({
  onCreate,
  onTemporary,
  onRename,
  onDelete,
}: {
  readonly onCreate: () => void;
  readonly onTemporary: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
}) {
  const panel = useSidePanel();

  return (
    <aside className="bg-card flex w-[260px] shrink-0 flex-col border-r">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">Sessions</h1>
          <p className="text-muted-foreground truncate text-[11px]">Isolated logins</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Refresh"
            onClick={() => void panel.refresh()}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
          <Button size="sm" onClick={onCreate}>
            <PlusIcon className="size-3.5" />
            New
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2 p-2">
        <SearchInput value={panel.search} onChange={panel.setSearch} />
        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={panel.filters.pinned}
                onCheckedChange={(checked) =>
                  panel.setFilters({ ...panel.filters, pinned: checked === true })
                }
              >
                Pinned
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={panel.filters.active}
                onCheckedChange={(checked) =>
                  panel.setFilters({ ...panel.filters, active: checked === true })
                }
              >
                Active
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={panel.filters.archived}
                onCheckedChange={(checked) =>
                  panel.setFilters({ ...panel.filters, archived: checked === true })
                }
              >
                Archived
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={panel.filters.temporary}
                onCheckedChange={(checked) =>
                  panel.setFilters({ ...panel.filters, temporary: checked === true })
                }
              >
                Temporary
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <Label htmlFor="tag-filter" className="text-xs">
                  Tag contains
                </Label>
                <input
                  id="tag-filter"
                  value={panel.filters.tag}
                  onChange={(event) =>
                    panel.setFilters({ ...panel.filters, tag: event.target.value })
                  }
                  className="border-input mt-1 h-7 w-full rounded-md border bg-transparent px-2 text-xs"
                  placeholder="work, client…"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Sort: {SORT_LABELS[panel.sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={panel.sort}
                onValueChange={(value) => panel.setSort(value as SessionSortOption)}
              >
                {(Object.keys(SORT_LABELS) as SessionSortOption[]).map((key) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={onTemporary}>
            <TimerIcon className="size-3.5" />
            Temp
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-1 pb-2">
        {panel.loading ? (
          <LoadingState />
        ) : panel.sessions.length === 0 ? (
          <EmptyState
            title="No sessions"
            description="Create a session for each Google (or other) login you want to keep apart."
            actionLabel="Create session"
            onAction={onCreate}
          />
        ) : (
          <SessionList
            maxHeight="none"
            className="h-full"
            items={panel.sessions}
            currentSessionId={panel.snapshot.currentSessionId}
            selectedSessionId={panel.selectedSessionId}
            onSelect={(item) => panel.openSessionDetail(item.session.id)}
            onActivate={(item) => {
              panel.openSessionDetail(item.session.id);
              void panel.switchSession(item.session.id);
            }}
            onRename={(item) => {
              panel.openSessionDetail(item.session.id);
              onRename();
            }}
            onDelete={(item) => {
              panel.openSessionDetail(item.session.id);
              onDelete();
            }}
            emptyLabel="No sessions match."
          />
        )}
      </div>
    </aside>
  );
}

function SessionDetailPane({
  onCreate,
  onRename,
  onDelete,
  run,
}: {
  readonly onCreate: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
  readonly run: (action: () => Promise<string | null>) => Promise<void>;
}) {
  const panel = useSidePanel();
  const session = panel.selectedSession;

  if (session === undefined) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Current site
            </p>
            <h2 className="truncate text-sm font-semibold">{panel.snapshot.hostname}</h2>
          </div>
          {shouldShowIsolationChip(panel.snapshot.isolationStatus) ? (
            <IsolationChip status={panel.snapshot.isolationStatus} />
          ) : null}
        </header>
        <EmptyState
          className="flex-1"
          title="Select or create a session"
          description={
            panel.snapshot.canIsolate
              ? `Create multiple isolated logins for ${panel.snapshot.hostname}. Each session opens a new logged-out tab.`
              : 'Focus a website tab such as google.com, then create a session for each account.'
          }
          actionLabel="Create session"
          onAction={onCreate}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              {session.session.icon}
            </span>
            <h2 className="truncate text-base font-semibold">{session.session.name}</h2>
            {panel.snapshot.currentSessionId === session.session.id ? (
              <Badge variant="default">Current tab</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs capitalize">
            {session.session.kind} · {session.tabCount} open tab
            {session.tabCount === 1 ? '' : 's'}
          </p>
        </div>
        {shouldShowIsolationChip(panel.snapshot.isolationStatus) ? (
          <IsolationChip status={panel.snapshot.isolationStatus} />
        ) : null}
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <section className="space-y-1.5">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Current site
            </p>
            <p className="text-sm font-medium">{panel.snapshot.hostname}</p>
          </section>

          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              onClick={() => void run(() => panel.switchSession(session.session.id))}
            >
              <ShuffleIcon className="size-3.5" />
              Use this tab
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run(() => panel.openInSession(session.session.id))}
            >
              <CopyIcon className="size-3.5" />
              Open new tab
            </Button>
            <Button size="sm" variant="outline" onClick={onRename}>
              <PencilIcon className="size-3.5" />
              Rename
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete}>
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </div>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide uppercase">Overview</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">Open tabs</p>
                <p className="text-lg font-semibold tabular-nums">{session.tabCount}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">State</p>
                <p className="font-medium capitalize">{session.session.state}</p>
              </div>
            </div>
            {session.session.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {session.session.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            {session.session.notes.trim().length > 0 ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {session.session.notes}
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide uppercase">Domains</h3>
            {session.session.domainGroupIds.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No managed domains linked yet.
              </p>
            ) : (
              session.session.domainGroupIds.map((domainId) => {
                const domain = panel.snapshot.domains.find(
                  (entry) => entry.id === domainId,
                );
                return (
                  <button
                    key={domainId}
                    type="button"
                    className="hover:bg-accent/60 flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-xs"
                    onClick={() => panel.openDomainDetail(domainId)}
                  >
                    <span className="flex items-center gap-2">
                      <GlobeIcon className="size-3.5" />
                      {domain?.name ?? domainId}
                    </span>
                    <Badge variant="outline">{domain?.mode ?? 'unknown'}</Badge>
                  </button>
                );
              })
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide uppercase">Settings</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="inherit-tabs">Inherit to child tabs</Label>
                <Switch
                  id="inherit-tabs"
                  checked={session.session.settings.inheritToChildTabs}
                  disabled
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tab-groups">Tab group integration</Label>
                <Switch
                  id="tab-groups"
                  checked={session.session.settings.tabGroupIntegration}
                  disabled
                />
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function DomainDetailView() {
  const panel = useSidePanel();
  const domain = panel.selectedDomain;

  if (domain === undefined) {
    return (
      <EmptyState
        title="Domain not found"
        description="This domain group may have been removed."
        actionLabel="Back to sessions"
        onAction={panel.openSessions}
      />
    );
  }

  const relatedSessions = panel.snapshot.sessions.filter((item) =>
    item.session.domainGroupIds.includes(domain.id),
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Back"
          onClick={panel.openSessions}
        >
          <ArrowLeftIcon className="size-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{domain.name}</h1>
          <p className="text-muted-foreground text-xs capitalize">{domain.mode} domain</p>
        </div>
        <Badge variant={domain.mode === 'managed' ? 'success' : 'muted'}>
          {domain.mode === 'managed' ? 'Isolated' : 'Off'}
        </Badge>
      </header>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <section className="space-y-1 text-xs">
            <h2 className="font-semibold tracking-wide uppercase">Isolation state</h2>
            <p className="text-muted-foreground">
              {domain.mode === 'managed'
                ? 'This domain is managed by Session Vault. Tabs must be assigned to a session before sending cookies.'
                : 'Isolation is not enabled for this domain group yet.'}
            </p>
          </section>

          <Separator />

          <section className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wide uppercase">
              Sessions using domain
            </h2>
            {relatedSessions.length === 0 ? (
              <p className="text-muted-foreground text-xs">No sessions linked yet.</p>
            ) : (
              <div className="space-y-1">
                {relatedSessions.map((item) => (
                  <SessionRow
                    key={item.session.id}
                    item={item}
                    onClick={() => panel.openSessionDetail(item.session.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-1 text-xs">
            <h2 className="font-semibold tracking-wide uppercase">Domain entries</h2>
            <ul className="text-muted-foreground list-disc space-y-1 pl-4">
              {domain.domains.map((entry: DomainEntry, index: number) => (
                <li key={`${entry.type}-${index}`}>
                  {entry.type === 'exact-host'
                    ? entry.host
                    : entry.type === 'registrable-domain'
                      ? `${entry.domain}${entry.includeSubdomains ? ' (+ subdomains)' : ''}`
                      : entry.pattern}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function SidePanelShell() {
  const panel = useSidePanel();
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const run = async (action: () => Promise<string | null>): Promise<void> => {
    setActionError(null);
    const message = await action();
    if (message !== null) {
      setActionError(message);
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-background flex h-screen min-h-0 w-full">
        <SessionSidebar
          onCreate={() => setCreateOpen(true)}
          onTemporary={() => void run(() => panel.createTemporarySession())}
          onRename={() => setRenameOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          {panel.error !== null ? (
            <div className="px-3 pt-2">
              <ErrorState message={panel.error} />
            </div>
          ) : null}
          {actionError !== null ? (
            <div className="px-3 pt-2">
              <ErrorState message={actionError} />
            </div>
          ) : null}
          {panel.view === 'domain-detail' ? (
            <DomainDetailView />
          ) : (
            <SessionDetailPane
              run={run}
              onCreate={() => setCreateOpen(true)}
              onRename={() => setRenameOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          )}
          <div className="border-t px-3 py-2">
            <CompatibilityLine
              compatibility={{
                level: 'full',
                reason: panel.snapshot.canIsolate
                  ? `Sessions on ${panel.snapshot.hostname} stay in this browser profile.`
                  : 'Focus a website tab to manage isolated logins.',
              }}
            />
          </div>
        </main>
      </div>

      <SessionNameDialog
        open={createOpen}
        title="New session"
        description={
          panel.snapshot.canIsolate
            ? `Create an isolated login for ${panel.snapshot.hostname}. Each session opens a new tab of this page.`
            : 'Focus a website tab, then create a named session for each account.'
        }
        confirmLabel="Create session"
        initialName={nextSessionName(panel.snapshot.sessions.length)}
        onOpenChange={setCreateOpen}
        onSubmit={(name) => {
          setCreateOpen(false);
          void run(() => panel.createSession(name));
        }}
      />

      <SessionNameDialog
        open={renameOpen}
        title="Rename session"
        description="This name is only shown in Session Vault."
        confirmLabel="Save"
        initialName={
          panel.selectedSession !== undefined
            ? stripSessionMarker(panel.selectedSession.session.name)
            : ''
        }
        onOpenChange={setRenameOpen}
        onSubmit={(name) => {
          const id = panel.selectedSessionId;
          if (id === null) {
            return;
          }
          setRenameOpen(false);
          void run(() => panel.renameSession(id, name));
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete session?"
        description={
          panel.selectedSession !== undefined
            ? `Delete “${panel.selectedSession.session.name}” and its isolated cookies. Tabs using it will be logged out.`
            : 'Delete this session and its isolated cookies.'
        }
        confirmLabel="Delete session"
        destructive
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          const id = panel.selectedSessionId;
          if (id === null) {
            return;
          }
          void run(async () => {
            const message = await panel.deleteSession(id);
            if (message === null) {
              panel.openSessions();
            }
            return message;
          });
        }}
      />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SidePanelProvider>
        <SidePanelShell />
      </SidePanelProvider>
    </ThemeProvider>
  );
}
