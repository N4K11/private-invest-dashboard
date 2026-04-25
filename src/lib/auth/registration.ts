import "server-only";

import { Prisma } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import type { RegisterInput } from "@/lib/auth/schema";
import { getPrismaClient } from "@/lib/db/client";
import { toSlugFragment } from "@/lib/utils";

function deriveWorkspaceName(input: RegisterInput) {
  return (
    input.workspaceName ??
    `Workspace ${input.displayName.split(/\s+/)[0] ?? "owner"}`
  );
}

function buildWorkspaceSlug(base: string, attempt: number) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export async function registerUser(input: RegisterInput) {
  const workspaceName = deriveWorkspaceName(input);
  const workspaceSlugBase = toSlugFragment(workspaceName) || "workspace";
  const defaultPortfolioSlug = "main-portfolio";
  const normalizedEmail = input.email.toLowerCase();

  const prisma = getPrismaClient();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const workspaceSlug = buildWorkspaceSlug(workspaceSlugBase, attempt);

    try {
      return await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: await hashPassword(input.password),
            displayName: input.displayName,
            timezone: input.timezone ?? "UTC",
            locale: "ru-RU",
          },
        });

        await transaction.account.create({
          data: {
            userId: user.id,
            provider: "CREDENTIALS",
            providerAccountId: normalizedEmail,
            email: normalizedEmail,
            metadata: {
              bootstrap: true,
            },
          },
        });

        const workspace = await transaction.workspace.create({
          data: {
            ownerId: user.id,
            name: workspaceName,
            slug: workspaceSlug,
            timezone: input.timezone ?? "UTC",
            defaultCurrency: "USD",
          },
        });

        await transaction.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            role: "OWNER",
            status: "active",
            joinedAt: new Date(),
          },
        });

        const portfolio = await transaction.portfolio.create({
          data: {
            workspaceId: workspace.id,
            name: "Р“Р»Р°РІРЅС‹Р№ РїРѕСЂС‚С„РµР»СЊ",
            slug: defaultPortfolioSlug,
            visibility: "PRIVATE",
            baseCurrency: "USD",
            riskProfile: "balanced",
          },
        });

        await transaction.subscription.create({
          data: {
            workspaceId: workspace.id,
            plan: "FREE",
            status: "ACTIVE",
            seatCount: 1,
          },
        });

        await transaction.auditLog.create({
          data: {
            workspaceId: workspace.id,
            portfolioId: portfolio.id,
            userId: user.id,
            actorType: "USER",
            action: "auth.register",
            entityType: "user",
            entityId: user.id,
            severity: "INFO",
            message: "Created SaaS account, workspace and bootstrap portfolio.",
            payload: {
              workspaceSlug,
              portfolioSlug: defaultPortfolioSlug,
              authProvider: "credentials",
            },
          },
        });

        return {
          user,
          workspace,
          portfolio,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");

        if (target.includes("email") || target.includes("providerAccountId")) {
          throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.");
        }

        if (target.includes("slug")) {
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРѕР±СЂР°С‚СЊ СЃРІРѕР±РѕРґРЅС‹Р№ slug РґР»СЏ workspace.");
}
