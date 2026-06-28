import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain,
  MousePointer,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Play,
  Bug,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SelfTestPanelProps {
  apiBase?: string;
  wsBase?: string;
}

// ---------------------------------------------------------------------------
// Backend message / data shapes
// ---------------------------------------------------------------------------

interface Workflow {
  name: string;
  prompt: string;
}

interface HealthInfo {
  playwright_connected: boolean;
  model: string;
}

type Verdict = 'pass' | 'fail' | 'inconclusive';

interface BugInfo {
  [key: string]: unknown;
}

interface StatusMessage {
  kind: 'status';
  text: string;
}

interface ThoughtMessage {
  kind: 'thought';
  text: string;
}

interface ActionMessage {
  kind: 'action';
  function_name: string;
  args: Record<string, unknown>;
  message: string;
}

interface ScreenshotMessage {
  kind: 'screenshot';
  data: string;
  url: string;
}

interface VerdictMessage {
  kind: 'verdict';
  verdict: Verdict;
  summary: string;
  bug: BugInfo | null;
}

interface DoneMessage {
  kind: 'done';
}

type IncomingMessage =
  | StatusMessage
  | ThoughtMessage
  | ActionMessage
  | ScreenshotMessage
  | VerdictMessage
  | DoneMessage;

// Log entries are the subset of messages we render in the left pane.
type LogEntry =
  | (StatusMessage & { id: number })
  | (ThoughtMessage & { id: number })
  | (ActionMessage & { id: number })
  | (VerdictMessage & { id: number });

// ---------------------------------------------------------------------------
// Fallback workflows (used if the /workflows endpoint fails)
// ---------------------------------------------------------------------------

const FALLBACK_WORKFLOWS: Workflow[] = [
  {
    name: 'Smoke test: load the home page',
    prompt: 'Open the app and verify the home page loads without errors.',
  },
  {
    name: 'Happy path: deploy a project',
    prompt:
      'Navigate the app, start a new deployment, and verify it completes successfully.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summariseArgs(args: Record<string, unknown> | undefined): string {
  if (!args || typeof args !== 'object') return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    let rendered: string;
    if (value === null || value === undefined) {
      rendered = String(value);
    } else if (typeof value === 'object') {
      try {
        rendered = JSON.stringify(value);
      } catch {
        rendered = '[object]';
      }
    } else {
      rendered = String(value);
    }
    if (rendered.length > 60) rendered = rendered.slice(0, 57) + '...';
    parts.push(`${key}: ${rendered}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SelfTestPanel: React.FC<SelfTestPanelProps> = ({
  apiBase = '',
  wsBase = 'ws://localhost:8000',
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>(FALLBACK_WORKFLOWS);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>(
    FALLBACK_WORKFLOWS[0]?.prompt ?? '',
  );
  const [targetUrl, setTargetUrl] = useState<string>('http://localhost:3001');
  const [health, setHealth] = useState<HealthInfo | null>(null);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [screenshot, setScreenshot] = useState<{ data: string; url: string } | null>(
    null,
  );
  const [running, setRunning] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<number>(0);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  // --- Load workflows + health on mount -----------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/uitest/workflows`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Workflow[] = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setWorkflows(data);
          setSelectedWorkflow(data[0].prompt);
        }
      } catch {
        // keep fallbacks
      }
    })();

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/uitest/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HealthInfo = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // --- Auto-scroll the log ------------------------------------------------
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log]);

  // --- Clean up the socket on unmount -------------------------------------
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const appendLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [...prev, entry]);
  }, []);

  const handleMessage = useCallback(
    (raw: MessageEvent) => {
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(raw.data as string) as IncomingMessage;
      } catch {
        return;
      }

      switch (msg.kind) {
        case 'status':
        case 'thought':
        case 'action':
          appendLog({ ...msg, id: nextId() });
          break;
        case 'screenshot':
          setScreenshot({ data: msg.data, url: msg.url });
          break;
        case 'verdict':
          appendLog({ ...msg, id: nextId() });
          setRunning(false);
          closeSocket();
          break;
        case 'done':
          setRunning(false);
          closeSocket();
          break;
        default:
          break;
      }
    },
    [appendLog, closeSocket],
  );

  const handleRun = useCallback(() => {
    if (running) return;

    // reset state for a fresh run
    setLog([]);
    setScreenshot(null);
    idRef.current = 0;
    closeSocket();

    setRunning(true);

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase}/api/uitest/stream`);
    } catch {
      appendLog({
        kind: 'status',
        text: 'Failed to open WebSocket connection.',
        id: nextId(),
      });
      setRunning(false);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'run',
          workflow: selectedWorkflow,
          target_url: targetUrl,
        }),
      );
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      appendLog({
        kind: 'status',
        text: 'WebSocket error — is the backend running?',
        id: nextId(),
      });
    };

    ws.onclose = () => {
      setRunning(false);
    };
  }, [running, wsBase, selectedWorkflow, targetUrl, handleMessage, appendLog, closeSocket]);

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderEntry = (entry: LogEntry) => {
    switch (entry.kind) {
      case 'thought':
        return (
          <div key={entry.id} className="flex gap-2 text-gray-400">
            <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm whitespace-pre-wrap break-words">{entry.text}</span>
          </div>
        );
      case 'status':
        return (
          <div key={entry.id} className="flex gap-2 text-amber-400">
            <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm whitespace-pre-wrap break-words">{entry.text}</span>
          </div>
        );
      case 'action': {
        const argSummary = summariseArgs(entry.args);
        return (
          <div key={entry.id} className="flex gap-2 text-blue-400">
            <MousePointer className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm min-w-0">
              <span className="font-mono font-semibold">{entry.function_name}</span>
              {argSummary && (
                <span className="text-blue-300/70 font-mono"> ({argSummary})</span>
              )}
              {entry.message && (
                <div className="text-gray-300 break-words">{entry.message}</div>
              )}
            </div>
          </div>
        );
      }
      case 'verdict': {
        const isPass = entry.verdict === 'pass';
        const isFail = entry.verdict === 'fail';
        const color = isPass
          ? 'text-green-400 border-green-700/50 bg-green-900/20'
          : isFail
          ? 'text-red-400 border-red-700/50 bg-red-900/20'
          : 'text-amber-400 border-amber-700/50 bg-amber-900/20';
        const Icon = isPass ? CheckCircle : isFail ? XCircle : AlertTriangle;
        return (
          <div key={entry.id} className={`flex gap-2 rounded-lg border p-3 ${color}`}>
            <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm min-w-0">
              <div className="font-semibold uppercase tracking-wide">
                {entry.verdict}
              </div>
              <div className="whitespace-pre-wrap break-words mt-1">{entry.summary}</div>
              {entry.bug && (
                <div className="mt-2 flex gap-2 items-start text-gray-300">
                  <Bug className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                    {JSON.stringify(entry.bug, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const connected = health?.playwright_connected === true;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-400" />
            UI Self-Test
          </h2>
          <p className="text-sm text-gray-400">
            Gemini Computer Use drives the live app like a real user.
          </p>
        </div>
        {/* Health badge */}
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            connected
              ? 'text-green-400 border-green-700/50 bg-green-900/20'
              : 'text-amber-400 border-amber-700/50 bg-amber-900/20'
          }`}
          title={health?.model ? `model: ${health.model}` : undefined}
        >
          {connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {connected ? 'tester ready' : 'start the Playwright client'}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1 min-w-[220px] flex-1">
          <label className="text-xs text-gray-400">Workflow</label>
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedWorkflow}
            onChange={(e) => setSelectedWorkflow(e.target.value)}
            disabled={running}
          >
            {workflows.map((wf, i) => (
              <option key={`${wf.name}-${i}`} value={wf.prompt}>
                {wf.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs text-gray-400">Target URL</label>
          <input
            type="text"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            disabled={running}
            placeholder="http://localhost:3001"
          />
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {running ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run
            </>
          )}
        </button>
      </div>

      {/* Dual-pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: log */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col h-[480px]">
          <div className="px-3 py-2 border-b border-gray-700 text-xs font-medium text-gray-400 uppercase tracking-wide">
            Agent Log
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {log.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                No activity yet. Pick a workflow and click Run.
              </div>
            ) : (
              log.map(renderEntry)
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* RIGHT: screenshot */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col h-[480px]">
          <div className="px-3 py-2 border-b border-gray-700 text-xs font-medium text-gray-400 uppercase tracking-wide">
            Live Screenshot
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-col items-center justify-center">
            {screenshot ? (
              <div className="w-full">
                <img
                  src={`data:image/png;base64,${screenshot.data}`}
                  alt="App under test"
                  className="w-full rounded-md border border-gray-700"
                />
                <div className="text-xs text-gray-400 mt-2 break-all text-center">
                  {screenshot.url}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Monitor className="w-10 h-10" />
                <span className="text-sm">No screenshot yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelfTestPanel;
