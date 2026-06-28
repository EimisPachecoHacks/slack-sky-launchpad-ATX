import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Wrench,
  ShieldCheck,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Loader,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — mirror of GET /api/learning/summary
// ---------------------------------------------------------------------------

type Phase = 'failure' | 'diagnose' | 'learned' | 'retry' | 'preempted' | 'success';

interface LearningKpis {
  skills_learned: number;
  failures_auto_resolved: number;
  deploys_preempted: number;
  avg_attempts_before: number | null;
  avg_attempts_after: number | null;
}

interface BeforeAfter {
  before: { label: string; avg_attempts: number | null; success_rate?: number; failures?: number };
  after: { label: string; avg_attempts: number | null; success_rate?: number; preempted?: number };
}

interface ErrorSolution {
  error_signature: string;
  root_cause: string;
  solution: string;
  provider: string;
  learned_at: string;
  reused_count: number;
  slug: string;
}

interface TimelineEvent {
  ts: string;
  phase: string;
  text: string;
  provider: string;
}

interface LearningSummary {
  is_sample: boolean;
  kpis: LearningKpis;
  before_after: BeforeAfter;
  errors_solutions: ErrorSolution[];
  timeline: TimelineEvent[];
}

interface LearningPanelProps {
  apiBase?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtNum = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : String(n);

const fmtAttempts = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : (Math.round(n * 10) / 10).toString();

const PHASE_STYLES: Record<Phase, { label: string; classes: string }> = {
  failure: { label: 'Failure', classes: 'bg-red-500/15 text-red-300 border-red-500/30' },
  diagnose: { label: 'Diagnose', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  learned: { label: 'Learned', classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  retry: { label: 'Retry', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  preempted: { label: 'Pre-empted', classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  success: { label: 'Success', classes: 'bg-green-500/15 text-green-300 border-green-500/30' },
};

const phaseStyle = (phase: string) =>
  PHASE_STYLES[phase as Phase] ?? {
    label: phase,
    classes: 'bg-gray-700/40 text-gray-300 border-gray-600/40',
  };

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return sec <= 1 ? 'just now' : `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, accent }) => (
  <div className="bg-gray-800 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2">
    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${accent}`}>
      {icon}
    </div>
    <div className="text-2xl font-bold text-white leading-none">{value}</div>
    <div className="text-xs text-gray-400">{label}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LearningPanel: React.FC<LearningPanelProps> = ({ apiBase = '' }) => {
  const [data, setData] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/learning/summary`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json = (await res.json()) as LearningSummary;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning summary');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="bg-gray-900 border border-gray-700/60 rounded-2xl p-6 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-purple-500/15 text-purple-300 shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold leading-tight">How It Learned</h2>
              {data?.is_sample && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Sample data
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              Continual Learning — the system improves with every failure.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading / Error / Empty states */}
      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
          <Loader className="w-5 h-5 animate-spin" />
          <span>Loading learning summary…</span>
        </div>
      )}

      {error && !data && (
        <div className="flex items-start gap-3 bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Could not load learning summary</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-8">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={<Brain className="w-5 h-5" />}
              accent="bg-purple-500/15 text-purple-300"
              label="Skills learned"
              value={fmtNum(data.kpis.skills_learned)}
            />
            <KpiCard
              icon={<Wrench className="w-5 h-5" />}
              accent="bg-blue-500/15 text-blue-300"
              label="Failures auto-resolved"
              value={fmtNum(data.kpis.failures_auto_resolved)}
            />
            <KpiCard
              icon={<ShieldCheck className="w-5 h-5" />}
              accent="bg-teal-500/15 text-teal-300"
              label="Deploys pre-empted"
              value={fmtNum(data.kpis.deploys_preempted)}
            />
            <KpiCard
              icon={<TrendingDown className="w-5 h-5" />}
              accent="bg-green-500/15 text-green-300"
              label="Avg attempts"
              value={
                <span className="flex items-center gap-1.5 text-2xl">
                  {fmtAttempts(data.kpis.avg_attempts_before)}
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                  {fmtAttempts(data.kpis.avg_attempts_after)}
                </span>
              }
            />
          </div>

          {/* Before vs After */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Before vs After</h3>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="flex-1 bg-red-900/15 border border-red-500/30 rounded-xl p-4">
                <div className="text-xs uppercase tracking-wide text-red-300/80 font-semibold">
                  {data.before_after.before.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-red-200">
                  {fmtAttempts(data.before_after.before.avg_attempts)}
                  <span className="text-sm font-normal text-gray-400 ml-1">avg attempts</span>
                </div>
                <div className="mt-1 text-sm text-gray-400 space-x-3">
                  {data.before_after.before.failures !== undefined && (
                    <span>{data.before_after.before.failures} failures</span>
                  )}
                  {data.before_after.before.success_rate !== undefined && (
                    <span>{Math.round(data.before_after.before.success_rate * 100)}% success</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center sm:px-1">
                <ArrowRight className="w-6 h-6 text-gray-500 rotate-90 sm:rotate-0" />
              </div>

              <div className="flex-1 bg-green-900/15 border border-green-500/30 rounded-xl p-4">
                <div className="text-xs uppercase tracking-wide text-green-300/80 font-semibold">
                  {data.before_after.after.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-green-200">
                  {fmtAttempts(data.before_after.after.avg_attempts)}
                  <span className="text-sm font-normal text-gray-400 ml-1">avg attempts</span>
                </div>
                <div className="mt-1 text-sm text-gray-400 space-x-3">
                  {data.before_after.after.preempted !== undefined && (
                    <span>{data.before_after.after.preempted} pre-empted</span>
                  )}
                  {data.before_after.after.success_rate !== undefined && (
                    <span>{Math.round(data.before_after.after.success_rate * 100)}% success</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error -> Solution table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Error → Solution</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-700/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/80 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Error</th>
                    <th className="px-3 py-2 font-medium">Root cause</th>
                    <th className="px-3 py-2 font-medium">Solution</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Learned</th>
                    <th className="px-3 py-2 font-medium text-center">Reused</th>
                  </tr>
                </thead>
                <tbody>
                  {data.errors_solutions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                        No learned solutions yet.
                      </td>
                    </tr>
                  ) : (
                    data.errors_solutions.map((row) => (
                      <tr
                        key={row.slug}
                        className="border-t border-gray-700/50 hover:bg-gray-800/40 align-top"
                      >
                        <td className="px-3 py-2 max-w-[16rem]">
                          <span
                            title={row.error_signature}
                            className="block truncate font-mono text-xs text-red-300"
                          >
                            {row.error_signature}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[14rem]">
                          <span title={row.root_cause} className="block truncate text-gray-300">
                            {row.root_cause}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[16rem]">
                          <span title={row.solution} className="block truncate text-gray-300">
                            {row.solution}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-400">{row.provider}</td>
                        <td
                          className="px-3 py-2 whitespace-nowrap text-gray-400"
                          title={row.learned_at}
                        >
                          {shortDate(row.learned_at)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            ×{row.reused_count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">What it did to learn</h3>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-500">No learning events recorded yet.</p>
            ) : (
              <ol className="relative border-l border-gray-700/60 ml-2 space-y-4">
                {data.timeline.map((event, idx) => {
                  const style = phaseStyle(event.phase);
                  return (
                    <li key={`${event.ts}-${idx}`} className="ml-4">
                      <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-gray-600" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.classes}`}
                        >
                          {style.label}
                        </span>
                        <span
                          className="text-xs text-gray-500"
                          title={new Date(event.ts).toLocaleString()}
                        >
                          {relativeTime(event.ts)}
                        </span>
                        {event.provider && (
                          <span className="text-xs text-gray-600">· {event.provider}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-300">{event.text}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default LearningPanel;
