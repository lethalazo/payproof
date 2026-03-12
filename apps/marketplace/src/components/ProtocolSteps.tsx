"use client";

import type { AgentEvent } from "@/lib/types";

interface ProtocolStepsProps {
  events: AgentEvent[];
}

type StepStatus = "pending" | "active" | "done";

interface Step {
  label: string;
  key: string;
}

const PROTOCOL_STEPS: Step[] = [
  { label: "Lock", key: "lock" },
  { label: "Encrypt", key: "encrypt" },
  { label: "Confirm", key: "confirm" },
  { label: "Claim", key: "claim" },
  { label: "Decrypt", key: "decrypt" },
];

function deriveStepStatuses(events: AgentEvent[]): { statuses: StepStatus[]; completedCount: number } {
  const statuses: StepStatus[] = PROTOCOL_STEPS.map(() => "pending");
  let completedCount = 0;
  let inFlight = false;

  for (const event of events) {
    if (event.type === "tool_call" && event.toolName === "fetch_paid_data") {
      // New payment initiated — reset to show active lock step
      inFlight = true;
      statuses[0] = "active";
      for (let i = 1; i < statuses.length; i++) statuses[i] = "pending";
    }
    if (event.type === "tool_result" && event.toolName === "fetch_paid_data") {
      try {
        const data = JSON.parse(event.content);
        if (data.success) {
          completedCount++;
          inFlight = false;
          // Full atomic cycle completed
          for (let i = 0; i < statuses.length; i++) statuses[i] = "done";
        } else if (data.error) {
          inFlight = false;
          // Payment failed — show lock as done (attempted), rest pending
          statuses[0] = "done";
          for (let i = 1; i < statuses.length; i++) statuses[i] = "pending";
        }
      } catch {
        inFlight = false;
      }
    }
  }

  return { statuses, completedCount };
}

export default function ProtocolSteps({ events }: ProtocolStepsProps) {
  const { statuses, completedCount } = deriveStepStatuses(events);
  const anyActive = statuses.some((s) => s !== "pending");

  if (!anyActive) return null;

  return (
    <div className="mb-4 bg-gray-900 rounded-lg border border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">Protocol Flow</span>
        {completedCount > 0 && (
          <span className="text-[10px] text-gray-600">
            {completedCount} atomic {completedCount === 1 ? "exchange" : "exchanges"} completed
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {PROTOCOL_STEPS.map((step, i) => {
          const status = statuses[i];
          return (
            <div key={step.key} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  status === "done"
                    ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40"
                    : status === "active"
                      ? "bg-blue-900/40 text-blue-400 border border-blue-700/40 animate-pulse"
                      : "bg-gray-800/50 text-gray-600 border border-gray-700/30"
                }`}
              >
                {status === "done" && (
                  <span className="text-emerald-400">&#10003;</span>
                )}
                {status === "active" && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
                {step.label}
              </div>
              {i < PROTOCOL_STEPS.length - 1 && (
                <span
                  className={`mx-0.5 text-xs ${
                    statuses[i] === "done" && statuses[i + 1] !== "pending"
                      ? "text-emerald-600"
                      : "text-gray-700"
                  }`}
                >
                  &rarr;
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
