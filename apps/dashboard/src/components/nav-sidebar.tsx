"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, LayoutTemplate, Bot, ScrollText, Settings, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NavUser {
  name: string;
  email: string;
  role: string;
}

interface NavSidebarProps {
  user: NavUser;
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavSidebar({ user }: NavSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex flex-col h-screen w-[250px] bg-gray-950 border-r border-gray-800 fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/">
          <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
            DURANDAL
          </h1>
        </Link>
        <p className="text-gray-600 text-xs mt-1">AI Workforce</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">
              {user.name}
            </p>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 capitalize"
            >
              {user.role}
            </Badge>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
