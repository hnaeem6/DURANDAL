"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Search,
  Zap,
  Receipt,
  Mail,
  Share2,
  Package,
  PackageSearch,
  Headphones,
  Bot,
  FileText,
  BarChart3,
  Shield,
  Globe,
  Database,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Icon lookup map (avoids importing all of lucide-react)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  receipt: Receipt,
  mail: Mail,
  share2: Share2,
  package: Package,
  packagesearch: PackageSearch,
  headphones: Headphones,
  bot: Bot,
  filetext: FileText,
  barchart3: BarChart3,
  shield: Shield,
  globe: Globe,
  database: Database,
  zap: Zap,
  clock: Clock,
};

function getIcon(name: string): LucideIcon {
  const key = name.toLowerCase().replace(/[\s-]+/g, "");
  return ICON_MAP[key] ?? Bot;
}

// ---------------------------------------------------------------------------
// Category styles
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  finance: "bg-green-900/50 text-green-300 border-green-800",
  communication: "bg-blue-900/50 text-blue-300 border-blue-800",
  marketing: "bg-purple-900/50 text-purple-300 border-purple-800",
  operations: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  support: "bg-pink-900/50 text-pink-300 border-pink-800",
  general: "bg-gray-800/50 text-gray-400 border-gray-700",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateParam {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string | number | boolean;
  description?: string;
  options?: string[];
}

interface TemplateStep {
  name: string;
  tool: string;
  prompt: string;
  requiresApproval: boolean;
  networkAllowlist: string[];
  timeout: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiredCredentials: string[];
  parameters: TemplateParam[];
  steps: TemplateStep[];
  schedule: string | null;
  networkAllowlist: string[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/templates");
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-1">
          Template Gallery
        </h2>
        <p className="text-gray-400 text-sm">
          Pre-built automation workflows ready to configure and run.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-800 text-gray-200 placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !categoryFilter
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-700"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(categoryFilter === cat ? null : cat)
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                categoryFilter === cat
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center text-gray-500 py-16">
          Loading templates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          No templates found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tmpl) => {
            const Icon = getIcon(tmpl.icon);
            return (
              <Link key={tmpl.id} href={`/templates/${tmpl.id}`}>
                <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-orange-400" />
                      </div>
                      <Badge
                        className={`text-[10px] capitalize shrink-0 ${CATEGORY_STYLES[tmpl.category] ?? CATEGORY_STYLES.general}`}
                      >
                        {tmpl.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-base text-gray-100 mt-3">
                      {tmpl.name}
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-sm line-clamp-2">
                      {tmpl.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {tmpl.schedule ? (
                          <span className="font-mono">{tmpl.schedule}</span>
                        ) : (
                          <span>On demand</span>
                        )}
                      </div>
                      <span>
                        {tmpl.steps.length} step
                        {tmpl.steps.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
