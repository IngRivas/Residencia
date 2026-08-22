"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface AdminNavProps {
  role: string
}

export default function AdminNav({ role }: AdminNavProps) {
  const pathname = usePathname()

  const links = [
    { href: "/admin", label: "Obras", exact: true },
    { href: "/admin/archivo", label: "Archivo de Obras" },
    ...(["SUPER_ADMIN", "ADMIN"].includes(role)
      ? [
          { href: "/admin/usuarios", label: "Usuarios" },
          { href: "/admin/papelera", label: "Papelera" },
        ]
      : []),
  ]

  return (
    <nav className="hidden gap-6 text-sm font-medium md:flex">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "transition-colors hover:text-primary",
              isActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
