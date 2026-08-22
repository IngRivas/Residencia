import type { Metadata } from "next"
import { Bricolage_Grotesque } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "sileo"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"
import { cn } from "@/lib/utils"

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SPEND",
  description: "Sistema para la gestión y control de obras de construcción y gastos diarios.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={cn("h-full", "antialiased", "dark", bricolage.variable)}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
        <Toaster
          position="top-center"
          theme="dark"
          options={{
            fill: "#27272a",
            styles: { title: "text-primary", description: "text-primary/80" },
          }}
        />
      </body>
    </html>
  )
}
