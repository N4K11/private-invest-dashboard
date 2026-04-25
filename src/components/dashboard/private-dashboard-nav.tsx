"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

function appendToken(path: string, token: string | null) {
  if (!token) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("token", token);
  return `${url.pathname}${url.search}`;
}

export function PrivateDashboardNav({
  dashboardSlug,
}: {
  dashboardSlug: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const basePath = `/invest-dashboard/${dashboardSlug}`;
  const settingsPath = `${basePath}/settings`;

  const items = [
    {
      href: appendToken(basePath, token),
      label: "Терминал",
      isActive: pathname === basePath,
    },
    {
      href: appendToken(settingsPath, token),
      label: "Settings / Health",
      isActive: pathname === settingsPath,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition",
            item.isActive
              ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100"
              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8 hover:text-white",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
