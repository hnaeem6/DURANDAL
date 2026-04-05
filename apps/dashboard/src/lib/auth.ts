import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createDb, users } from "@durandal/db";
import { eq } from "drizzle-orm";
import { config } from "./config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: config.nextAuthSecret,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          return null;
        }

        const db = getDb();
        const user = db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      // Allow public routes without auth
      const publicPaths = ["/login", "/setup", "/api/auth", "/api/setup"];
      const isPublicPath = publicPaths.some((path) =>
        pathname.startsWith(path)
      );

      if (isPublicPath) {
        // Redirect authenticated users away from /login
        if (pathname.startsWith("/login") && auth) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return Response.redirect(url);
        }
        return true;
      }

      // Protect all other routes
      if (!auth) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return Response.redirect(url);
      }

      return true;
    },
  },
});

export const handlers = result.handlers;
export const auth = result.auth;
// Re-export signIn/signOut with explicit type annotations to avoid
// TypeScript "cannot be named" portability error with @auth/core/providers
export const signIn: typeof result.signIn = result.signIn;
export const signOut: typeof result.signOut = result.signOut;
