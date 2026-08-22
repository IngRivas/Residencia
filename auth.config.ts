import type { NextAuthConfig } from "next-auth"
import { checkIsWithinHours } from "./lib/schedule"

export const authConfig = {
  providers: [], // Filled in auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.permissions = (user as any).permissions
        token.id = user.id
        token.schedules = (user as any).schedules
      }

      if (token.schedules && typeof token.role === "string" && token.role.toLowerCase() === "capturista") {
        if (!checkIsWithinHours(token.schedules as any[])) {
          return null as any // Returning null invalidates the token/session
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = token.role
        ;(session.user as any).permissions = token.permissions
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig
