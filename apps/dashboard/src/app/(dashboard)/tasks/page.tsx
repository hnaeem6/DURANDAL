"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, RefreshCw } from "lucide-react";

interface Task {
  id: string;
  status: string;
  input: string;
  output: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-900/50 text-green-300 border-green-800",
  failed: "bg-red-900/50 text-red-300 border-red-800",
  executing: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  planning: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  awaiting_approval: "bg-blue-900/50 text-blue-300 border-blue-800",
  pending: "bg-gray-800/50 text-gray-400 border-gray-700",
  cancelled: "bg-gray-800/50 text-gray-500 border-gray-700",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 text-sm">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/">
              <Plus className="h-4 w-4" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Input</TableHead>
              <TableHead className="w-[180px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && !loading ? (
              <TableRow className="border-gray-800">
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  No tasks yet. Create one from the Home page.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="border-gray-800 cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <TableCell>
                    <Badge
                      className={`text-xs capitalize ${STATUS_STYLES[task.status] ?? STATUS_STYLES.pending}`}
                    >
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300 max-w-[400px] truncate">
                    {task.input}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {new Date(task.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl bg-gray-950 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-100">
              Task {selectedTask?.id.slice(0, 8)}...
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <Badge
                  className={`capitalize ${STATUS_STYLES[selectedTask.status] ?? STATUS_STYLES.pending}`}
                >
                  {selectedTask.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Input</p>
                <p className="text-sm text-gray-300 bg-gray-900 rounded-lg p-3 whitespace-pre-wrap">
                  {selectedTask.input}
                </p>
              </div>
              {selectedTask.output && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Output</p>
                  <p className="text-sm text-gray-300 bg-gray-900 rounded-lg p-3 whitespace-pre-wrap max-h-64 overflow-auto">
                    {selectedTask.output}
                  </p>
                </div>
              )}
              {selectedTask.error && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Error</p>
                  <p className="text-sm text-red-400 bg-red-900/20 rounded-lg p-3 whitespace-pre-wrap">
                    {selectedTask.error}
                  </p>
                </div>
              )}
              <div className="flex gap-6 text-xs text-gray-500">
                <span>
                  Created: {new Date(selectedTask.createdAt).toLocaleString()}
                </span>
                <span>
                  Updated: {new Date(selectedTask.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
