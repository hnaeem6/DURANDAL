"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface HealthData {
  status: string;
  version: string;
  services: {
    hermes: string;
    nanoclaw: string;
  };
}

interface UserEntry {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-orange-900/50 text-orange-300 border-orange-800",
  admin: "bg-blue-900/50 text-blue-300 border-blue-800",
  member: "bg-gray-800/50 text-gray-400 border-gray-700",
};

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  async function fetchHealth() {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // ignore
    } finally {
      setHealthLoading(false);
    }
  }

  async function fetchUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      } else if (res.status === 403) {
        setUsersError("Admin access required to view users.");
      } else {
        setUsersError("Failed to fetch users.");
      }
    } catch {
      setUsersError("Failed to fetch users.");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    fetchUsers();
  }, []);

  return (
    <div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-gray-950 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">System Info</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchHealth}
                    disabled={healthLoading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${healthLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Version</span>
                  <span className="text-sm text-gray-200 font-mono">
                    {health?.version ?? "..."}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Overall Status</span>
                  <Badge
                    className={
                      health?.status === "healthy"
                        ? "bg-green-900/50 text-green-300 border-green-800"
                        : "bg-yellow-900/50 text-yellow-300 border-yellow-800"
                    }
                  >
                    {health?.status ?? "loading..."}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-950 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg">Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Hermes (Orchestrator)</span>
                  <div className="flex items-center gap-2">
                    {health?.services.hermes === "healthy" ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span
                      className={`text-sm ${
                        health?.services.hermes === "healthy"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {health?.services.hermes ?? "..."}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">NanoClaw (Agent Runtime)</span>
                  <div className="flex items-center gap-2">
                    {health?.services.nanoclaw === "healthy" ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span
                      className={`text-sm ${
                        health?.services.nanoclaw === "healthy"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {health?.services.nanoclaw ?? "..."}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="bg-gray-950 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Users</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={usersLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${usersLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersError ? (
                <p className="text-sm text-gray-500 py-4">{usersError}</p>
              ) : (
                <div className="rounded-lg border border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="w-[100px]">Role</TableHead>
                        <TableHead className="w-[180px]">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 && !usersLoading ? (
                        <TableRow className="border-gray-800">
                          <TableCell
                            colSpan={4}
                            className="text-center text-gray-500 py-8"
                          >
                            No users found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user) => (
                          <TableRow key={user.id} className="border-gray-800">
                            <TableCell className="text-gray-200">
                              {user.name}
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`text-xs capitalize ${ROLE_STYLES[user.role] ?? ROLE_STYLES.member}`}
                              >
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm">
                              {new Date(user.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <Card className="bg-gray-950 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">About DURANDAL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-gray-300">
                  <strong>DURANDAL</strong> - Your unbreakable AI workforce. Runs
                  local. Stays private. Gets smarter.
                </p>
                <p className="text-gray-400 text-sm">
                  DURANDAL is a self-hosted AI agent platform that orchestrates
                  autonomous task execution through a modular architecture. It
                  combines a dashboard for task management, Hermes for
                  orchestration, and NanoClaw as the agent runtime.
                </p>

                <h4 className="text-gray-300 mt-6">Architecture</h4>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>
                    <strong className="text-gray-300">Dashboard</strong> - Next.js
                    web interface for task submission, monitoring, and
                    configuration
                  </li>
                  <li>
                    <strong className="text-gray-300">Hermes</strong> -
                    Orchestrator service that plans and coordinates task execution
                  </li>
                  <li>
                    <strong className="text-gray-300">NanoClaw</strong> - Agent
                    runtime that executes individual steps using AI models and
                    tools
                  </li>
                </ul>

                <h4 className="text-gray-300 mt-6">Attribution</h4>
                <p className="text-gray-400 text-sm">
                  Built with Next.js, Auth.js, Drizzle ORM, better-sqlite3,
                  shadcn/ui, Tailwind CSS, and lucide-react. Powered by Claude
                  (Anthropic).
                </p>
                <p className="text-gray-500 text-xs mt-4">
                  Copyright 2024-2026 DURANDAL Contributors. All rights reserved.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
