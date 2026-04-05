"use client";

import { useEffect, useState, useCallback } from "react";

interface TaskEvent {
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface TaskData {
  id: string;
  status: string;
  input: string;
  output: string | null;
  error: string | null;
  events: TaskEvent[];
}

export function useTaskStream(taskId: string | null) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);

  const poll = useCallback(async () => {
    if (!taskId) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
      }
    } catch {
      // Ignore polling errors
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    setLoading(true);
    poll().then(() => setLoading(false));

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [taskId, poll]);

  return {
    task,
    events: task?.events ?? [],
    status: task?.status ?? "idle",
    loading,
  };
}
