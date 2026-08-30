import {
  ArrowUpRightIcon,
  GlobeIcon,
  LayoutGridIcon,
  MoonIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SunIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatRelativeTime } from '@/app/format-relative.ts';
import { useManagerController, type ManagerSiteId } from '@/app/manager/use-manager.ts';
import type { SessionListItem } from '@/app/types.ts';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { EmptyState } from '@/components/empty-state.tsx';
import { ErrorState } from '@/components/error-state.tsx';
import { LoadingState } from '@/components/loading-state.tsx';
import { SessionNameDialog } from '@/components/session-name-dialog.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { useTheme, type Theme } from '@/hooks/use-theme.ts';
import { stripSessionMarker } from '@/modules/domain/session-factory.ts';
import { cn } from '@/lib/utils.ts';

function siteInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'S';
}

function NavButton({
  active,
  label,
  count,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly count: number;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
    </button>
  );
}

function SessionCard({
  item,
  siteName,
  onOpen,
  onRename,
  onDelete,
}: {
  readonly item: SessionListItem;
  readonly siteName?: string;
  readonly onOpen: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
}) {
  const { session, tabCount } = item;

  return (
    <article className="bg-card hover:border-primary/30 group relative overflow-hidden rounded-xl border p-4 shadow-xs transition-colors">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: session.color }}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{session.name}</h3>
            <Badge variant="outline" className="capitalize">
              {session.kind}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {siteName !== undefined ? `${siteName} · ` : ''}
            {tabCount} tab{tabCount === 1 ? '' : 's'} ·{' '}
            {formatRelativeTime(session.lastUsedAt)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
        <Button size="sm" onClick={onOpen}>
          <ArrowUpRightIcon className="size-3.5" />
          Open
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
    </article>
  );
}

function SettingsPane() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Session Vault stays on this device. Sessions and cookies are never uploaded.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <MoonIcon className="size-4" />
            ) : (
              <SunIcon className="size-4" />
            )}
            <Label htmlFor="theme-select">Theme</Label>
          </div>
          <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            <SelectTrigger id="theme-select" className="w-36">
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Privacy</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Local only</Badge>
          <Badge variant="secondary">No telemetry</Badge>
          <Badge variant="secondary">No cloud sync</Badge>
        </div>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>Multiple logins on the same site stay in separate cookie jars</li>
          <li>Host access is requested per site when you create a session</li>
          <li>Nothing is sent to a remote server</li>
        </ul>
      </section>
    </div>
  );
}

function ManagerApp() {
  const manager = useManagerController();
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const renameTarget = useMemo(
    () => manager.snapshot.sessions.find((item) => item.session.id === renameId),
    [manager.snapshot.sessions, renameId],
  );
  const deleteTarget = useMemo(
    () => manager.snapshot.sessions.find((item) => item.session.id === deleteId),
    [manager.snapshot.sessions, deleteId],
  );

  const run = async (action: () => Promise<string | null>): Promise<void> => {
    setActionError(null);
    const message = await action();
    if (message !== null) {
      setActionError(message);
    }
  };

  const selectSite = (id: ManagerSiteId): void => {
    manager.setSelectedSiteId(id);
    manager.setView('sessions');
  };

  return (
    <div className="flex h-screen min-h-0">
      <aside className="bg-card flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <ShieldCheckIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Session Vault</p>
            <p className="text-muted-foreground text-[11px]">Isolated logins</p>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={manager.search}
              onChange={(event) => manager.setSearch(event.target.value)}
              placeholder="Search sites and sessions"
              aria-label="Search sites and sessions"
              className="pl-8"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2">
          <nav className="space-y-4 pb-4" aria-label="Sites">
            <div>
              <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                Library
              </p>
              <NavButton
                active={manager.view === 'sessions' && manager.selectedSiteId === 'all'}
                label="All sites"
                count={manager.totalCount}
                onClick={() => selectSite('all')}
              />
            </div>

            <div>
              <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                Sites
              </p>
              {manager.sites.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-xs">
                  No isolated sites yet. Create a session from the popup.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {manager.sites.map((site) => (
                    <button
                      key={site.group.id}
                      type="button"
                      onClick={() => selectSite(site.group.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                        manager.view === 'sessions' &&
                          manager.selectedSiteId === site.group.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold">
                        {siteInitial(site.group.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{site.group.name}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {site.sessions.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {manager.unassigned.length > 0 ? (
              <div>
                <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                  Other
                </p>
                <NavButton
                  active={
                    manager.view === 'sessions' && manager.selectedSiteId === 'unassigned'
                  }
                  label="Unassigned"
                  count={manager.unassigned.length}
                  onClick={() => selectSite('unassigned')}
                />
              </div>
            ) : null}
          </nav>
        </ScrollArea>

        <div className="border-t p-2">
          <Button
            variant={manager.view === 'settings' ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => manager.setView('settings')}
          >
            <Settings2Icon className="size-3.5" />
            Settings
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {manager.view === 'settings' ? (
          <SettingsPane />
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
              <div>
                <h1 className="text-lg font-semibold">{manager.selectedSiteName}</h1>
                <p className="text-muted-foreground text-sm">
                  {manager.visibleSessions.length} session
                  {manager.visibleSessions.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void manager.refresh()}>
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-8 p-6">
                {manager.error !== null ? <ErrorState message={manager.error} /> : null}
                {actionError !== null ? <ErrorState message={actionError} /> : null}

                {manager.loading ? (
                  <LoadingState label="Loading sessions…" />
                ) : manager.totalCount === 0 ? (
                  <EmptyState
                    icon={<GlobeIcon className="size-8" />}
                    title="No sessions yet"
                    description="Open a website, click the Session Vault icon, and create a session for each account you want to keep separate."
                  />
                ) : manager.selectedSiteId === 'all' ? (
                  manager.sites.length === 0 && manager.unassigned.length === 0 ? (
                    <EmptyState
                      title="Nothing matches"
                      description="Try a different search."
                    />
                  ) : (
                    <>
                      {manager.sites.map((site) => (
                        <section key={site.group.id} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-muted flex size-7 items-center justify-center rounded-lg text-xs font-semibold">
                              {siteInitial(site.group.name)}
                            </span>
                            <h2 className="text-sm font-semibold">{site.group.name}</h2>
                            <Badge variant="muted">{site.sessions.length}</Badge>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {site.sessions.map((item) => (
                              <SessionCard
                                key={item.session.id}
                                item={item}
                                onOpen={() =>
                                  void run(() => manager.openSession(item.session.id))
                                }
                                onRename={() => setRenameId(item.session.id)}
                                onDelete={() => setDeleteId(item.session.id)}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                      {manager.unassigned.length > 0 ? (
                        <section className="space-y-3">
                          <h2 className="text-sm font-semibold">Unassigned</h2>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {manager.unassigned.map((item) => (
                              <SessionCard
                                key={item.session.id}
                                item={item}
                                onOpen={() =>
                                  void run(() => manager.openSession(item.session.id))
                                }
                                onRename={() => setRenameId(item.session.id)}
                                onDelete={() => setDeleteId(item.session.id)}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </>
                  )
                ) : manager.visibleSessions.length === 0 ? (
                  <EmptyState
                    icon={<LayoutGridIcon className="size-8" />}
                    title="No sessions here"
                    description="Create one from the popup while this site is open."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {manager.visibleSessions.map((item) => (
                      <SessionCard
                        key={item.session.id}
                        item={item}
                        onOpen={() =>
                          void run(() => manager.openSession(item.session.id))
                        }
                        onRename={() => setRenameId(item.session.id)}
                        onDelete={() => setDeleteId(item.session.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </main>

      <SessionNameDialog
        open={renameId !== null}
        title="Rename session"
        description="This name is only shown in Session Vault."
        confirmLabel="Save"
        initialName={
          renameTarget !== undefined ? stripSessionMarker(renameTarget.session.name) : ''
        }
        onOpenChange={(open) => {
          if (!open) {
            setRenameId(null);
          }
        }}
        onSubmit={(name) => {
          const id = renameId;
          setRenameId(null);
          if (id !== null) {
            void run(() => manager.renameSession(id, name));
          }
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete session?"
        description={
          deleteTarget !== undefined
            ? `Delete “${deleteTarget.session.name}” and its isolated cookies. Tabs using it will be logged out.`
            : 'Delete this session and its isolated cookies.'
        }
        confirmLabel="Delete session"
        destructive
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
          }
        }}
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (id !== null) {
            void run(() => manager.deleteSession(id));
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ManagerApp />
    </ThemeProvider>
  );
}
