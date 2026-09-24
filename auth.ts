import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/db"
import * as bcrypt from "bcryptjs"
import { checkIsWithinHours } from "@/lib/schedule"

import { CredentialsSignin } from "next-auth"

class OutOfHoursError extends CredentialsSignin {
  code = "OUT_OF_HOURS"
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        const email = (credentials.email as string).toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        })

        if (!user) return null

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) return null

        // La restricción de horario aplica únicamente al rol de Capturista
        // if (user.role?.name?.toLowerCase() === "capturista" && !checkIsWithinHours(user.role.schedules as any[])) {
        //   throw new Error("OUT_OF_HOURS")
        // }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
          permissions: typeof user.role.permissions === "string" ? JSON.parse(user.role.permissions) : user.role.permissions,
          schedules: user.role.schedules,
        }
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user && user.id) {
        try {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: "INICIO_SESION",
              entityType: "Usuario",
              entityId: user.id,
              details: `Inició sesión`,
            },
          })
        } catch (error) {
          console.error("Error logging login:", error)
        }
      }
    },
  },
})
