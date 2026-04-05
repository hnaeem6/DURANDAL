"use client";

import { useState } from "react";
import { DURANDAL_VERSION } from "@durandal/core";
import { useTaskStream } from "@/hooks/use-task-stream";

export default function Home() {
  const [input, setInput] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { events, status } = useTaskStream(taskId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const { id } = await res.json();
      setTaskId(id);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center pt-8">
      <h1 className="text-3xl font-bold tracking-wider mb-2 bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
        DURANDAL
      </h1>
      <p className="text-gray-500 text-sm mb-8">v{DURANDAL_VERSION}</p>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What should DURANDAL do?"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            {submitting ? "Sending..." : "Run"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </form>

      {taskId && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-400 text-sm">Task {taskId.slice(0, 8)}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                status === "completed"
                  ? "bg-green-900 text-green-300"
                  : status === "failed"
                    ? "bg-red-900 text-red-300"
                    : "bg-yellow-900 text-yellow-300"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="space-y-2">
            {events.map((event, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3"
              >
                <div className="flex justify-between items-start">
                  <span className="text-gray-300 text-sm">{event.message}</span>
                  <span className="text-gray-600 text-xs ml-2 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
