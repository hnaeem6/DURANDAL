"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  details: string | null;
}

const ACTION_STYLES: Record<string, string> = {
  create: "bg-green-900/50 text-green-300 border-green-800",
  update: "bg-blue-900/50 text-blue-300 border-blue-800",
  delete: "bg-red-900/50 text-red-300 border-red-800",
  login: "bg-purple-900/50 text-purple-300 border-purple-800",
};

function getActionStyle(action: string): string {
  const key = Object.keys(ACTION_STYLES).find((k) =>
    action.toLowerCase().includes(k),
  );
  return key
    ? ACTION_STYLES[key]
    : "bg-gray-800/50 text-gray-400 border-gray-700";
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAudit() {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAudit();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-400 text-sm">
          {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        </p>
        <Button variant="outline" size="sm" onClick={fetchAudit}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[140px]">Actor</TableHead>
              <TableHead className="w-[140px]">Action</TableHead>
              <TableHead className="w-[160px]">Resource</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && !loading ? (
              <TableRow className="border-gray-800">
                <TableCell
                  colSpan={5}
                  className="text-center text-gray-500 py-8"
                >
                  No audit log entries yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="border-gray-800">
                  <TableCell className="text-gray-400 text-sm">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {entry.actor}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getActionStyle(entry.action)}`}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {entry.resource}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm max-w-[300px] truncate">
                    {entry.details ?? "-"}
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
