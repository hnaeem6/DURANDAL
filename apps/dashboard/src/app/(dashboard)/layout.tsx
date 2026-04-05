import { auth } from "@/lib/auth";
import { NavSidebar } from "@/components/nav-sidebar";
import { NavHeader } from "@/components/nav-header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    role: ((session.user as Record<string, unknown>).role as string) ?? "member",
  };

  return (
    <div className="flex min-h-screen">
      <NavSidebar user={user} />
      <div className="flex-1 ml-[250px] flex flex-col">
        <NavHeader />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
