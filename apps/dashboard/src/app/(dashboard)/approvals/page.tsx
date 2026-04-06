"use client";

import { useEffect, useState } from "react";
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
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface Approval {
  id: string;
  taskId: string;
  stepName: string;
  stepIndex: number;
  status: string;
  description?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  approved: "bg-green-900/50 text-green-300 border-green-800",
  rejected: "bg-red-900/50 text-red-300 border-red-800",
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function fetchApprovals() {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActing(id);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch {
      // ignore
    } finally {
      setActing(null);
    }
  }

  useEffect(() => {
    fetchApprovals();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 text-sm">
            {approvals.length} pending approval{approvals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchApprovals}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Task ID</TableHead>
              <TableHead className="w-[180px]">Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 && !loading ? (
              <TableRow className="border-gray-800">
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No pending approvals.
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => (
                <TableRow key={approval.id} className="border-gray-800">
                  <TableCell>
                    <Badge
                      className={`text-xs capitalize ${STATUS_STYLES[approval.status] ?? STATUS_STYLES.pending}`}
                    >
                      {approval.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div>
                      <p className="font-medium">{approval.stepName}</p>
                      {approval.description && (
                        <p className="text-xs text-gray-500 mt-0.5 max-w-[300px] truncate">
                          {approval.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm font-mono">
                    {approval.taskId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {new Date(approval.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {approval.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={acting === approval.id}
                          onClick={() => handleAction(approval.id, "approve")}
                          className="text-green-400 border-green-800 hover:bg-green-900/30"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={acting === approval.id}
                          onClick={() => handleAction(approval.id, "reject")}
                          className="text-red-400 border-red-800 hover:bg-red-900/30"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 capitalize">
                        {approval.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
