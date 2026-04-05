"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Home", subtitle: "Submit and monitor tasks" },
  "/tasks": { title: "Tasks", subtitle: "View all task history" },
  "/agents": { title: "Agents", subtitle: "Memory and profile management" },
  "/audit": { title: "Audit Log", subtitle: "System activity history" },
  "/settings": { title: "Settings", subtitle: "System configuration" },
};

export function NavHeader() {
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? {
    title: "DURANDAL",
    subtitle: pathname,
  };

  return (
    <header className="border-b border-gray-800 bg-gray-950/50 backdrop-blur-sm px-8 py-4">
      <h2 className="text-lg font-semibold text-gray-100">{page.title}</h2>
      <p className="text-sm text-gray-500">{page.subtitle}</p>
    </header>
  );
}
