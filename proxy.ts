import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const user = req.auth?.user as any
  const userRole = user?.role

  const isApiRoute = nextUrl.pathname.startsWith("/api")
  const isAdminRoute = nextUrl.pathname.startsWith("/admin")
  const isCapturaRoute = nextUrl.pathname.startsWith("/captura")
  const isLoginRoute = nextUrl.pathname === "/login"

  // 1. If login route and logged in, redirect to their main view
  if (isLoginRoute) {
    if (isLoggedIn) {
      if (userRole === "CAPTURISTA") {
        return NextResponse.redirect(new URL("/captura", nextUrl))
      }
      return NextResponse.redirect(new URL("/admin", nextUrl))
    }
    return NextResponse.next()
  }

  // 2. Route protection for non-logged in users
  if (
    !isLoggedIn &&
    (isAdminRoute ||
      isCapturaRoute ||
      (isApiRoute && !nextUrl.pathname.startsWith("/api/auth")))
  ) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 3. Admin / Super Admin namespace protection
  if (isAdminRoute) {
    if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", nextUrl))
    }
  }

  // 4. Captura namespace protection
  if (isCapturaRoute) {
    if (
      userRole !== "CAPTURISTA" &&
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/403", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
