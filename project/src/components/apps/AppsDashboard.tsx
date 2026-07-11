import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitPullRequest,
  HelpCircle,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

interface LatestRun {
  status: string;
  summary: string;
  error: string;
  solution: string;
  mr_url: string;
}

interface AppCard {
  app_id: string;
  name: string;
  provider: string;
  environment: string;
  url: string;
  alive: boolean;
  health_status: string;
  status: 'passing' | 'failing' | 'untested' | 'inconclusive';
  test_case_count: number;
  last_tested: string | null;
  latest_run: LatestRun | null;
}

interface AppsResponse {
  is_sample: boolean;
  apps: AppCard[];
}

interface AppsDashboardProps {
  apiBase?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function StatusBadge({ status }: { status: AppCard['status'] }) {
  const base =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';
  switch (status) {
    case 'passing':
      return (
        <span className={`${base} bg-green-500/15 text-green-400 border border-green-500/30`}>
          <CheckCircle2 className="w-3 h-3" />
          100% • passing
        </span>
      );
    case 'failing':
      return (
        <span className={`${base} bg-red-500/15 text-red-400 border border-red-500/30`}>
          <XCircle className="w-3 h-3" />
          failing
        </span>
      );
    case 'inconclusive':
      return (
        <span className={`${base} bg-amber-500/15 text-amber-400 border border-amber-500/30`}>
          <AlertTriangle className="w-3 h-3" />
          inconclusive
        </span>
      );
    case 'untested':
    default:
      return (
        <span className={`${base} bg-gray-700/60 text-gray-300 border border-gray-600`}>
          <HelpCircle className="w-3 h-3" />
          untested
        </span>
      );
  }
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-gray-700/60 text-gray-300 border border-gray-600">
      {children}
    </span>
  );
}

interface DestroyModalProps {
  app: AppCard;
  apiBase: string;
  onClose: () => void;
  onDestroyed: () => void;
}

function DestroyModal({ app, apiBase, onClose, onDestroyed }: DestroyModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDestroy = confirmText.trim() === app.name && !busy;

  const handleDestroy = useCallback(async () => {
    if (confirmText.trim() !== app.name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/apps/${app.app_id}`, { method: 'DELETE' });
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          detail = body.detail || detail;
        } catch {
          /* keep default */
        }
        throw new Error(detail);
      }
      onDestroyed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to destroy app');
      setBusy(false);
    }
  }, [apiBase, app.app_id, app.name, confirmText, onDestroyed]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-red-500/40 bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-gray-700 p-5">
          <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-500/15 p-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-100">Destroy “{app.name}”?</h3>
            <p className="mt-1 text-sm text-gray-400">
              This is permanent and cannot be undone.
            </p>
          </div>
          {!busy && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-gray-300">
            <p className="mb-2 font-medium text-red-300">This will:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Tear down the app’s cloud infrastructure via Terraform (if any is still tracked).</li>
              <li>Remove the app and its <span className="font-medium">{app.test_case_count}</span> test case{app.test_case_count === 1 ? '' : 's'} and all run history.</li>
              <li>Delete it from this dashboard — it will no longer be monitored or testable.</li>
            </ul>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">
              Type <span className="font-mono font-semibold text-gray-200">{app.name}</span> to confirm
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              placeholder={app.name}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-red-500/60 disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words">{error}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-700 p-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleDestroy}
            disabled={!canDestroy}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Destroying…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Destroy app
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppRowProps {
  app: AppCard;
  apiBase: string;
  onRefresh: () => void;
}

function AppRow({ app, apiBase, onRefresh }: AppRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [showDestroy, setShowDestroy] = useState(false);

  const run = app.latest_run;
  const rel = relativeTime(app.last_tested);
  const isSample = app.app_id.startsWith('sample-');

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    setGenMessage(null);
    try {
      const res = await fetch(`${apiBase}/api/apps/${app.app_id}/generate-tests`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: { cases: { case_id: string; name: string; prompt: string }[] } =
        await res.json();
      const n = Array.isArray(data.cases) ? data.cases.length : 0;
      setGenMessage(`${n} cases generated — run them in the UI Self-Test panel below`);
      onRefresh();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate test cases');
    } finally {
      setGenerating(false);
    }
  }, [apiBase, app.app_id, onRefresh]);

  const canExpand = app.status === 'failing' || app.status === 'passing';

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800/60 overflow-hidden">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
        {/* App */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-100 truncate">{app.name}</span>
            <Chip>{app.provider}</Chip>
            <Chip>{app.environment}</Chip>
          </div>
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline break-all"
            >
              {app.url}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          )}
        </div>

        {/* Live */}
        <div className="flex items-center gap-1.5 md:w-20" title={app.health_status}>
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              app.alive ? 'bg-green-400' : 'bg-gray-500'
            }`}
          />
          <span className={`text-xs ${app.alive ? 'text-green-400' : 'text-gray-400'}`}>
            {app.alive ? 'live' : 'down'}
          </span>
        </div>

        {/* Status */}
        <div className="md:w-44">
          <StatusBadge status={app.status} />
        </div>

        {/* Tests */}
        <div className="md:w-32 text-xs text-gray-400">
          <div className="text-gray-300">
            {app.test_case_count} {app.test_case_count === 1 ? 'case' : 'cases'}
          </div>
          {rel && <div className="text-gray-500">{rel}</div>}
        </div>

        {/* Actions */}
        <div className="md:w-48 flex flex-col items-start gap-1">
          {app.status === 'untested' && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate test cases'
              )}
            </button>
          )}
          {canExpand && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-gray-100"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {app.status === 'failing' ? 'View failure' : 'View latest run'}
            </button>
          )}
          {!isSample && (
            <button
              onClick={() => setShowDestroy(true)}
              className="inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300"
              title="Permanently destroy this deployed app"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Destroy
            </button>
          )}
        </div>
      </div>

      {showDestroy && (
        <DestroyModal
          app={app}
          apiBase={apiBase}
          onClose={() => setShowDestroy(false)}
          onDestroyed={() => {
            setShowDestroy(false);
            onRefresh();
          }}
        />
      )}

      {/* Generation feedback */}
      {(genMessage || genError) && (
        <div className="px-4 pb-3 -mt-1">
          {genMessage && <p className="text-xs text-green-400">{genMessage}</p>}
          {genError && <p className="text-xs text-red-400">{genError}</p>}
        </div>
      )}

      {/* Expandable detail */}
      {expanded && canExpand && run && (
        <div className="border-t border-gray-700 bg-gray-900/60 p-4 space-y-3 text-xs">
          {app.status === 'failing' ? (
            <>
              {run.error && (
                <div>
                  <div className="text-gray-400 mb-1">Error</div>
                  <pre className="font-mono text-red-400 whitespace-pre-wrap break-words bg-gray-950/60 border border-red-500/20 rounded p-2">
                    {run.error}
                  </pre>
                </div>
              )}
              {run.solution && (
                <div>
                  <div className="text-gray-400 mb-1">How it was solved</div>
                  <pre className="font-mono text-green-400 whitespace-pre-wrap break-words bg-gray-950/60 border border-green-500/20 rounded p-2">
                    {run.solution}
                  </pre>
                </div>
              )}
              {run.mr_url && (
                <a
                  href={run.mr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  View MR
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : (
            <div>
              <div className="text-gray-400 mb-1">Latest run</div>
              <p className="text-gray-200 whitespace-pre-wrap break-words">
                {run.summary || 'No summary available.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppsDashboard({ apiBase = '' }: AppsDashboardProps) {
  const [apps, setApps] = useState<AppCard[]>([]);
  const [isSample, setIsSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/apps`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: AppsResponse = await res.json();
      setApps(Array.isArray(data.apps) ? data.apps : []);
      setIsSample(Boolean(data.is_sample));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-100">Deployed Apps</h2>
            {isSample && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Sample data
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            Live status, autonomous test coverage, and how failures were fixed.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && apps.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading deployed apps…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          No deployed apps found.
        </div>
      )}

      {!error && apps.length > 0 && (
        <div className="space-y-3">
          {apps.map((app) => (
            <AppRow key={app.app_id} app={app} apiBase={apiBase} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
