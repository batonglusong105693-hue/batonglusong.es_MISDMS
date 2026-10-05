import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "./permissions";

export { rolePermissions, hasPermission, canAccessRoute } from "./permissions";
export type { Role } from "./permissions";

const nextAuthSecret = process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "development-secret-change-me" : undefined);

if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET must be set before starting the app in production.");
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.password) {
          return null;
        }

        if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          department: user.department,
          position: user.position,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.position = user.position;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const authedUser = session.user as any;

        authedUser.id = token.id as string;
        authedUser.role = token.role as Role;
        authedUser.department = token.department as string | null | undefined;
        authedUser.position = token.position as string | null | undefined;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: nextAuthSecret,
  jwt: {
    secret: nextAuthSecret,
  },
};