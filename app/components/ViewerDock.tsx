"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Building2,
  FolderArchive,
  Users,
  Truck,
  MoreVertical,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import GlobalSearch from "./GlobalSearch"
import AdminZoomControls from "./AdminZoomControls"
import SignOutButton from "./SignOutButton"

interface ViewerDockProps {
  user: any
  initialTextZoom: number
}

export default function ViewerDock({ user, initialTextZoom }: ViewerDockProps) {
  const pathname = usePathname()

  const links = [
    { href: "/viewer", label: "Obras activas", icon: Building2, exact: true },
    { href: "/viewer/proveedores", label: "Proveedores", icon: Truck },
    { href: "/viewer/usuarios", label: "Usuarios", icon: Users },
    { href: "/viewer/archivo", label: "Archivo de obras", icon: FolderArchive },
  ]

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4">
      {/* Main Navigation Dock */}
      <nav className="flex items-center gap-1 rounded-full border border-border/50 bg-card/90 px-3 py-2 shadow-2xl backdrop-blur-xl sm:gap-2">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href)

          const Icon = link.icon

          return (
            <Link key={link.href} href={link.href} className="group relative">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-2 hover:scale-125",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {link.label}
              </span>
            </Link>
          )
        })}

        {/* 3 Dots Menu */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground transition-all duration-200 outline-none hover:-translate-y-2 hover:scale-125 hover:text-foreground">
              <MoreVertical className="h-6 w-6" />
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                Más opciones
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="center"
              className="mb-4 w-auto min-w-[140px] rounded-3xl border border-border/50 bg-card/90 p-2 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex flex-col gap-2 p-1">
                <div className="flex w-full justify-center">
                  <AdminZoomControls
                    userId={user.id}
                    initialTextZoom={initialTextZoom}
                  />
                </div>
                <div className="flex w-full justify-center">
                  <SignOutButton />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* External Search Button */}
      <div className="flex items-center rounded-full border border-border/50 bg-card/90 p-2 shadow-2xl backdrop-blur-xl">
        <div className="group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:-translate-y-2 hover:scale-125 hover:text-foreground">
          <GlobalSearch />
          <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            Buscar
          </span>
        </div>
      </div>

      {/* Hidden Zoom Controls to apply zoom globally on mount */}
      <div className="hidden">
        <AdminZoomControls userId={user.id} initialTextZoom={initialTextZoom} />
      </div>
    </div>
  )
}
