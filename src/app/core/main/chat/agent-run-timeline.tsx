"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react"
import type { AgentChange, AgentRunStatus, AgentSkillSummary, AgentTraceEvent, ToolCall } from "@/lib/agent/types"
import { AgentChangesPanel } from "./agent-changes-panel"
import { AgentContextTray, type RagSourceDetail } from "./agent-context-tray"
import { agentStatusText, formatAgentDuration, formatAgentToolName } from "./agent-display-utils"

interface AgentRunTimelineProps {
  status?: AgentRunStatus
  isRunning?: boolean
  traceEvents?: AgentTraceEvent[]
  toolCalls?: ToolCall[]
  changes?: AgentChange[]
  showChanges?: boolean
  ragSources?: string[]
  ragSourceDetails?: RagSourceDetail[]
  loadedSkills?: AgentSkillSummary[]
}

function eventIcon(event: AgentTraceEvent) {
  if (event.status === "error") {
    return <AlertTriangle className="size-4 text-destructive" />
  }

  if (event.status === "running") {
    return <Loader2 className="size-4 animate-spin text-blue-500" />
  }

  if (event.type === "tool_call" || event.type === "tool_result") {
    return <Wrench className="size-4 text-blue-500" />
  }

  if (event.type === "final") {
    return <CheckCircle2 className="size-4 text-green-500" />
  }

  return <Sparkles className="size-4 text-primary" />
}

function shouldShowEventMessage(event: AgentTraceEvent) {
  return event.type === "tool_call" || event.type === "tool_result" || event.type === "error"
}

function hasMeaningfulTraceDetail(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0
  }

  return value !== undefined && value !== null
}

function shouldShowTraceEvent(event: AgentTraceEvent) {
  if (event.type === "final") {
    return false
  }

  if (event.type === "change") {
    return false
  }

  if (event.type === "approval") {
    return false
  }

  if (
    (event.type === "model_call" || event.type === "model_response") &&
    event.status === "success" &&
    !hasMeaningfulTraceDetail(event.output) &&
    event.duration === undefined
  ) {
    return false
  }

  return true
}

function filterTimelineEvents(events: AgentTraceEvent[]) {
  return events.filter(shouldShowTraceEvent)
}

function formatTraceDetail(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function compactTraceInput(value: unknown) {
  return hasMeaningfulTraceDetail(value) ? value : undefined
}

function compactTraceOutput(event: AgentTraceEvent, visibleMessage?: string) {
  const value = event.output

  if (!hasMeaningfulTraceDetail(value)) {
    return undefined
  }

  if (event.type === "model_call" || event.type === "model_response") {
    return value
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return visibleMessage ? undefined : value
  }

  const output = value as {
    ok?: unknown
    success?: unknown
    message?: unknown
    data?: unknown
    error?: unknown
  }

  if (
    "ok" in output ||
    "success" in output ||
    "message" in output ||
    "data" in output ||
    "error" in output
  ) {
    if (event.status !== "error") {
      return visibleMessage ? undefined : output.data
    }

    const compacted: Record<string, unknown> = {}

    if (output.ok !== undefined) compacted.ok = output.ok
    if (output.success !== undefined) compacted.success = output.success
    if (!visibleMessage && output.message !== undefined) compacted.message = output.message
    if (output.error !== undefined) compacted.error = output.error
    if (output.data !== undefined) compacted.data = output.data

    return hasMeaningfulTraceDetail(compacted) ? compacted : undefined
  }

  return visibleMessage ? undefined : value
}

function traceDetailClassName(event: AgentTraceEvent) {
  const maxHeight = event.type === "model_call" || event.type === "model_response"
    ? "max-h-96"
    : "max-h-72"

  return `${maxHeight} overflow-auto rounded bg-muted/60 p-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`
}

function statusIcon(status: AgentRunStatus, isRunning: boolean) {
  if (isRunning) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
  }

  if (status === "failed") {
    return <AlertTriangle className="size-4 shrink-0 text-destructive" />
  }

  return <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
}

function eventFromToolCall(toolCall: ToolCall): AgentTraceEvent {
  return {
    id: toolCall.id,
    runId: "live",
    type: "tool_call",
    title: formatAgentToolName(toolCall.toolName),
    status: toolCall.status === "running"
      ? "running"
      : toolCall.status === "error"
        ? "error"
        : toolCall.status === "success"
          ? "success"
          : "pending",
    timestamp: toolCall.timestamp,
    toolName: toolCall.toolName,
    input: toolCall.params,
    output: toolCall.result,
    message: toolCall.result?.message || toolCall.result?.error,
  }
}

export function AgentRunTimeline({
  status = "idle",
  isRunning = false,
  traceEvents = [],
  toolCalls = [],
  changes = [],
  showChanges = true,
  ragSources = [],
  ragSourceDetails = [],
  loadedSkills = [],
}: AgentRunTimelineProps) {
  const [expandedEvents, setExpandedEvents] = React.useState<string[]>([])

  const events = React.useMemo(() => {
    if (traceEvents.length > 0) {
      return filterTimelineEvents(traceEvents)
    }

    return toolCalls.map(eventFromToolCall)
  }, [traceEvents, toolCalls])
  const hasRunningEvent = events.some((event) => event.status === "running")
  const hasActiveVisibleEvent = events.some((event) => event.status === "running" || event.status === "pending")
  const [liveNow, setLiveNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!hasRunningEvent) {
      return
    }

    setLiveNow(Date.now())
    const timer = window.setInterval(() => {
      setLiveNow(Date.now())
    }, 100)

    return () => window.clearInterval(timer)
  }, [hasRunningEvent])

  const toggleEvent = (id: string) => {
    setExpandedEvents((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  if (!isRunning && events.length === 0 && ragSources.length === 0 && changes.length === 0 && loadedSkills.length === 0) {
    return null
  }

  const showStatusRow = (isRunning && !hasActiveVisibleEvent && status !== "idle") ||
    (events.length === 0 && (status === "failed" || status === "stopped"))

  return (
    <div className="flex flex-col gap-2">
      <AgentContextTray
        ragSources={ragSources}
        ragSourceDetails={ragSourceDetails}
        loadedSkills={loadedSkills}
      />

      {events.length > 0 && (
        <ol className="flex flex-col gap-1">
          {events.map((event) => {
            const expanded = expandedEvents.includes(event.id)
            const visibleMessage = shouldShowEventMessage(event) ? event.message : undefined
            const inputDetail = compactTraceInput(event.input)
            const outputDetail = compactTraceOutput(event, visibleMessage)
            const hasDetails = Boolean(visibleMessage || inputDetail !== undefined || outputDetail !== undefined)
            const displayDuration = event.duration ?? (
              event.status === "running"
                ? Math.max(0, liveNow - event.timestamp)
                : undefined
            )

            return (
              <li key={event.id} className="text-sm">
                <button
                  type="button"
                  className="group flex w-full items-start gap-2 py-1.5 text-left"
                  onClick={() => hasDetails && toggleEvent(event.id)}
                  aria-expanded={hasDetails ? expanded : undefined}
                >
                  <span className="mt-0.5 shrink-0">{eventIcon(event)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={expanded ? "min-w-0 break-words [overflow-wrap:anywhere]" : "truncate"}>
                        {event.toolName ? formatAgentToolName(event.toolName) : event.title}
                      </span>
                      {displayDuration !== undefined && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatAgentDuration(displayDuration)}
                        </span>
                      )}
                    </span>
                    {visibleMessage && !expanded && (
                      <span className="mt-1 block max-w-full truncate text-xs text-muted-foreground">
                        {visibleMessage}
                      </span>
                    )}
                  </span>
                  {hasDetails && (
                    expanded ? (
                      <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )
                  )}
                </button>

                {expanded && hasDetails && (
                  <div className="ml-6 flex flex-col gap-2 border-l pl-3 pb-2 text-xs">
                    {visibleMessage && (
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-muted-foreground">描述</div>
                        <div className="rounded bg-muted/60 p-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground">
                          {visibleMessage}
                        </div>
                      </div>
                    )}
                    {inputDetail !== undefined && (
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-muted-foreground">参数</div>
                        <pre className={traceDetailClassName(event)}>{formatTraceDetail(inputDetail)}</pre>
                      </div>
                    )}
                    {outputDetail !== undefined && (
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-muted-foreground">结果</div>
                        <pre className={traceDetailClassName(event)}>{formatTraceDetail(outputDetail)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {showStatusRow && (
        <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
          {statusIcon(status, isRunning)}
          <span className="truncate">{agentStatusText[status]}</span>
        </div>
      )}

      {showChanges && !isRunning && <AgentChangesPanel changes={changes} />}
    </div>
  )
}
