import { LayoutGridIcon, PlusIcon, TimerIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePopupController } from '@/app/popup/use-popup.ts';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { EmptyState } from '@/components/empty-state.tsx';
import { ErrorState } from '@/components/error-state.tsx';
import { LoadingState } from '@/components/loading-state.tsx';
import { IsolationChip, shouldShowIsolationChip } from '@/components/isolation-chip.tsx';
import { SessionList } from '@/components/session-list.tsx';
import { SessionNameDialog } from '@/components/session-name-dialog.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { Button } from '@/components/ui/button.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { stripSessionMarker } from '@/modules/domain/session-factory.ts';

function nextSessionName(existingCount: number): string {
  return `Session ${existingCount + 1}`;
}

function SiteGlyph({
  label,
  favIconUrl,
}: {
  readonly label: string;
  readonly favIconUrl: string | null;
}) {
  const letter = label.trim().slice(0, 1).toUpperCase() || 'S';
  if (favIconUrl !== null) {
    return (
      <img
        src={favIconUrl}
        alt=""
        width={20}
        height={20}
        className="size-5 rounded-md"
      />
    );
  }
  return (
    <span
      className="bg-primary/15 text-primary flex size-5 items-center justify-center rounded-md text-[10px] font-semibold"
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

function PopupApp() {
  const popup = usePopupController();
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<string | null>): Promise<void> => {
    setActionError(null);
    const message = await action();
    if (message !== null) {
      setActionError(message);
    }
  }, []);

  const renameTarget = useMemo(
    () => popup.sessions.find((item) => item.session.id === renameId),
    [popup.sessions, renameId],
  );
  const deleteTarget = useMemo(
    () => popup.sessions.find((item) => item.session.id === deleteId),
    [popup.sessions, deleteId],
  );

  const siteReady = popup.snapshot.canIsolate;
  const sessionCount = popup.sessions.length;

  return (
    <TooltipProvider>
      <div className="flex w-[360px] flex-col">
        <header className="flex items-center gap-2.5 border-b px-3 py-2.5">
          <SiteGlyph
            label={popup.snapshot.siteLabel}
            favIconUrl={popup.snapshot.favIconUrl}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold" title={popup.snapshot.origin}>
              {popup.snapshot.siteLabel}
            </h1>
            <p className="text-muted-foreground text-[11px]">
              {siteReady
                ? `${sessionCount} session${sessionCount === 1 ? '' : 's'} on this site`
                : 'Open a website to manage sessions'}
            </p>
          </div>
          {siteReady && shouldShowIsolationChip(popup.snapshot.isolationStatus) ? (
            <IsolationChip status={popup.snapshot.isolationStatus} className="text-[10px]" />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void popup.openManager().then(() => {
                window.close();
              });
            }}
          >
            <LayoutGridIcon className="size-3.5" />
            Manage
          </Button>
        </header>

        <div className="flex flex-col gap-2 p-2">
          {popup.error !== null ? <ErrorState message={popup.error} /> : null}
          {actionError !== null ? <ErrorState message={actionError} /> : null}

          {popup.loading ? (
            <LoadingState label="Loading…" />
          ) : !siteReady ? (
            <EmptyState
              title="No website tab"
              description="Click a site like google.com, then open SessionVault to create isolated logins."
            />
          ) : popup.sessions.length === 0 ? (
            <EmptyState
              title={`No sessions for ${popup.snapshot.siteLabel}`}
              description="Each session opens a new logged-out tab of this page. Click a session later to open another copy."
              actionLabel="Create session"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <SessionList
              items={popup.sessions}
              currentSessionId={popup.snapshot.currentSessionId}
              hint="Open"
              maxHeight="400px"
              onSelect={(item) => {
                void run(async () => {
                  if (item.session.id === popup.snapshot.currentSessionId) {
                    window.close();
                    return null;
                  }
                  const message =
                    popup.snapshot.isolationStatus === 'unassigned'
                      ? await popup.switchSession(item.session.id)
                      : await popup.openSession(item.session.id);
                  if (message === null) {
                    window.close();
                  }
                  return message;
                });
              }}
              onRename={(item) => setRenameId(item.session.id)}
              onDelete={(item) => setDeleteId(item.session.id)}
              emptyLabel={`No sessions for ${popup.snapshot.siteLabel}.`}
            />
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!siteReady}>
              <PlusIcon className="size-3.5" />
              Session
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!siteReady}
              onClick={() => void run(() => popup.createTemporarySession())}
            >
              <TimerIcon className="size-3.5" />
              Temporary
            </Button>
          </div>
        </div>
      </div>

      <SessionNameDialog
        open={createOpen}
        title="New session"
        description={`Isolated login for ${popup.snapshot.siteLabel}. Each new session opens in a new tab.`}
        confirmLabel="Create"
        initialName={nextSessionName(popup.snapshot.sessions.length)}
        onOpenChange={setCreateOpen}
        onSubmit={(name) => {
          setCreateOpen(false);
          void run(() => popup.createSession(name));
        }}
      />

      <SessionNameDialog
        open={renameId !== null}
        title="Rename session"
        description="This name is only shown in SessionVault."
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
            void run(() => popup.renameSession(id, name));
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
            void run(() => popup.deleteSession(id));
          }
        }}
      />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PopupApp />
    </ThemeProvider>
  );
}
