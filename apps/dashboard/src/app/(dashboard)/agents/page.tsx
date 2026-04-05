"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RefreshCw } from "lucide-react";

export default function AgentsPage() {
  const [memory, setMemory] = useState("");
  const [userProfile, setUserProfile] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function fetchMemory() {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setMemory(data.memory ?? "");
        setUserProfile(data.user ?? "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function checkRole() {
    try {
      // Check by attempting a session fetch - the layout passes role info
      // We'll check by reading the session from the cookie via next-auth
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const session = await res.json();
        const role = session?.user?.role;
        setIsAdmin(role === "admin" || role === "owner");
      }
    } catch {
      // default to non-admin
    }
  }

  useEffect(() => {
    fetchMemory();
    checkRole();
  }, []);

  async function handleSave(type: "memory" | "user") {
    setSaving(true);
    setSaveStatus(null);
    try {
      const body =
        type === "memory" ? { memory } : { user: userProfile };
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaveStatus("Saved successfully");
      } else {
        const data = await res.json();
        setSaveStatus(data.error ?? "Failed to save");
      }
    } catch {
      setSaveStatus("Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  return (
    <div>
      {saveStatus && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-lg ${
            saveStatus.includes("success")
              ? "bg-green-900/30 text-green-400 border border-green-800"
              : "bg-red-900/30 text-red-400 border border-red-800"
          }`}
        >
          {saveStatus}
        </div>
      )}

      <Tabs defaultValue="memory" className="w-full">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="profile">User Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="memory">
          <Card className="bg-gray-950 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">MEMORY.md</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMemory}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      onClick={() => handleSave("memory")}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Persistent memory used by the AI agent across sessions.
                {!isAdmin && " Read-only for non-admin users."}
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                className="min-h-[400px] font-mono text-sm bg-gray-900 border-gray-800"
                placeholder="No memory content yet..."
                readOnly={!isAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card className="bg-gray-950 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">USER.md</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMemory}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      onClick={() => handleSave("user")}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                User profile and preferences for the AI agent.
                {!isAdmin && " Read-only for non-admin users."}
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={userProfile}
                onChange={(e) => setUserProfile(e.target.value)}
                className="min-h-[400px] font-mono text-sm bg-gray-900 border-gray-800"
                placeholder="No user profile content yet..."
                readOnly={!isAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
