import "server-only";

import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { verifyPassword } from "@/lib/auth/password";
import { credentialsSchema } from "@/lib/auth/schema";
import { normalizeWorkspaceRole, pickPrimaryMembership } from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import { getAuthSecret, getEnv, isSaasAuthConfigured } from "@/lib/env";
import { applyRateLimit } from "@/lib/security/rate-limit";

function getRequestHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const header = headers[name] ?? headers[name.toLowerCase()];

  if (Array.isArray(header)) {
    return header[0] ?? "";
  }

  return header ?? "";
}

function getAuthRequestIp(headers: Record<string, string | string[] | undefined>) {
  const forwardedFor =
    getRequestHeader(headers, "x-forwarded-for") ||
    getRequestHeader(headers, "cf-connecting-ip") ||
    getRequestHeader(headers, "x-real-ip");

  if (!forwardedFor) {
    return "unknown";
  }

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

function buildCredentialsProvider() {
  return CredentialsProvider({
    name: "Email и пароль",
    credentials: {
      email: {
        label: "Email",
        type: "email",
        placeholder: "owner@example.com",
      },
      password: {
        label: "Пароль",
        type: "password",
      },
    },
    async authorize(rawCredentials, request) {
      if (!isSaasAuthConfigured()) {
        return null;
      }

      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) {
        return null;
      }

      const env = getEnv();
      const ip = getAuthRequestIp(request.headers ?? {});
      const rateLimit = applyRateLimit(
        `auth:credentials:${ip}:${parsed.data.email}`,
        env.AUTH_RATE_LIMIT_MAX_REQUESTS,
        env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
      );

      if (!rateLimit.success) {
        return null;
      }

      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        include: {
          memberships: {
            where: {
              status: "active",
              workspace: {
                isArchived: false,
              },
            },
            include: {
              workspace: true,
            },
          },
        },
      });

      if (!user?.passwordHash || !user.isActive) {
        return null;
      }

      const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);

      if (!isValidPassword) {
        return null;
      }

      const membership = pickPrimaryMembership(user.memberships);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.displayName ?? user.email,
        displayName: user.displayName ?? user.email,
        workspaceId: membership?.workspaceId ?? null,
        workspaceRole: membership ? normalizeWorkspaceRole(membership.role) : null,
        workspaceSlug: membership?.workspace.slug ?? null,
      };
    },
  });
}

export const authOptions: AuthOptions = {
  secret: getAuthSecret() ?? undefined,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: isSaasAuthConfigured() ? [buildCredentialsProvider()] : [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.displayName = user.displayName ?? user.name ?? null;
        token.workspaceId = user.workspaceId ?? null;
        token.workspaceRole = user.workspaceRole ?? null;
        token.workspaceSlug = user.workspaceSlug ?? null;
      }

      if (!token.userId && token.sub) {
        token.userId = token.sub;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.displayName =
          typeof token.displayName === "string"
            ? token.displayName
            : session.user.name ?? undefined;
        session.user.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : undefined;
        session.user.workspaceRole =
          typeof token.workspaceRole === "string"
            ? token.workspaceRole
            : undefined;
        session.user.workspaceSlug =
          typeof token.workspaceSlug === "string" ? token.workspaceSlug : undefined;
      }

      return session;
    },
  },
};
