import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

async function loadPrismaClient() {
  try {
    const clientModule = await import("@prisma/client");
    return clientModule.PrismaClient;
  } catch (error) {
    throw new Error(
      `Prisma Client is not available. Run "npm run db:generate" after configuring DATABASE_URL and DIRECT_URL.\n${error}`,
    );
  }
}

async function main() {
  const PrismaClient = await loadPrismaClient();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for prisma seed.");
  }

  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });
  const passwordHash = await hash("DemoPass123!", 12);

  try {
    const user = await prisma.user.upsert({
      where: { email: "demo-owner@subairfall.local" },
      update: {
        displayName: "Demo Owner",
        timezone: "Europe/Saratov",
        passwordHash,
      },
      create: {
        email: "demo-owner@subairfall.local",
        passwordHash,
        displayName: "Demo Owner",
        timezone: "Europe/Saratov",
        locale: "ru-RU",
      },
    });

    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "CREDENTIALS",
          providerAccountId: user.email,
        },
      },
      update: {
        email: user.email,
      },
      create: {
        userId: user.id,
        provider: "CREDENTIALS",
        providerAccountId: user.email,
        email: user.email,
        metadata: {
          seeded: true,
        },
      },
    });

    const workspace = await prisma.workspace.upsert({
      where: { slug: "demo-workspace" },
      update: {
        name: "Demo Workspace",
        ownerId: user.id,
        defaultCurrency: "USD",
        timezone: "Europe/Saratov",
      },
      create: {
        name: "Demo Workspace",
        slug: "demo-workspace",
        ownerId: user.id,
        defaultCurrency: "USD",
        timezone: "Europe/Saratov",
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        role: "OWNER",
        status: "active",
        joinedAt: new Date(),
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
        status: "active",
        joinedAt: new Date(),
      },
    });

    const portfolio = await prisma.portfolio.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: "demo-portfolio",
        },
      },
      update: {
        name: "Demo Alternative Assets",
        baseCurrency: "USD",
        visibility: "PRIVATE",
        riskProfile: "balanced",
      },
      create: {
        workspaceId: workspace.id,
        name: "Demo Alternative Assets",
        slug: "demo-portfolio",
        baseCurrency: "USD",
        visibility: "PRIVATE",
        riskProfile: "balanced",
        legacyAccessEnabled: false,
      },
    });

    const integration = await prisma.integration.upsert({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name: "Legacy Google Sheets Demo",
        },
      },
      update: {
        portfolioId: portfolio.id,
        type: "GOOGLE_SHEETS",
        mode: "SYNC_READ",
        status: "ACTIVE",
        config: {
          spreadsheetId: "demo-sheet-id",
          adapter: "legacy_private_dashboard",
        },
      },
      create: {
        workspaceId: workspace.id,
        portfolioId: portfolio.id,
        name: "Legacy Google Sheets Demo",
        type: "GOOGLE_SHEETS",
        mode: "SYNC_READ",
        status: "ACTIVE",
        config: {
          spreadsheetId: "demo-sheet-id",
          adapter: "legacy_private_dashboard",
        },
      },
    });

    const asset = await prisma.asset.upsert({
      where: {
        workspaceId_normalizedKey: {
          workspaceId: workspace.id,
          normalizedKey: "crypto:btc",
        },
      },
      update: {
        name: "Bitcoin",
        symbol: "BTC",
        category: "CRYPTO",
        externalSource: "coingecko",
        externalId: "bitcoin",
        metadata: {
          pricing: "live",
        },
      },
      create: {
        workspaceId: workspace.id,
        name: "Bitcoin",
        symbol: "BTC",
        category: "CRYPTO",
        normalizedKey: "crypto:btc",
        externalSource: "coingecko",
        externalId: "bitcoin",
        metadata: {
          pricing: "live",
        },
      },
    });

    await prisma.position.upsert({
      where: {
        portfolioId_assetId: {
          portfolioId: portfolio.id,
          assetId: asset.id,
        },
      },
      update: {
        integrationId: integration.id,
        quantity: "0.2500000000",
        averageEntryPrice: "52000.00000000",
        currentPrice: "64000.00000000",
        manualCurrentPrice: null,
        priceSource: "COINGECKO",
        status: "ACTIVE",
        notes: "Demo seeded BTC position for SaaS foundation.",
      },
      create: {
        portfolioId: portfolio.id,
        assetId: asset.id,
        integrationId: integration.id,
        quantity: "0.2500000000",
        averageEntryPrice: "52000.00000000",
        currentPrice: "64000.00000000",
        manualCurrentPrice: null,
        priceSource: "COINGECKO",
        status: "ACTIVE",
        notes: "Demo seeded BTC position for SaaS foundation.",
        openedAt: new Date(),
      },
    });

    const buyReference = "seed-buy-btc-demo";
    const existingBuy = await prisma.transaction.findUnique({
      where: { externalReference: buyReference },
    });

    if (!existingBuy) {
      await prisma.transaction.create({
        data: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          integrationId: integration.id,
          action: "BUY",
          occurredAt: new Date(),
          quantity: "0.2500000000",
          unitPrice: "52000.00000000",
          fees: "25.00000000",
          currency: "USD",
          externalReference: buyReference,
          notes: "Demo buy transaction seeded by prisma/seed.mjs",
        },
      });
    }

    const existingSnapshot = await prisma.priceSnapshot.findFirst({
      where: {
        portfolioId: portfolio.id,
        assetId: asset.id,
        source: "COINGECKO",
      },
    });

    if (!existingSnapshot) {
      await prisma.priceSnapshot.create({
        data: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          currency: "USD",
          price: "64000.00000000",
          source: "COINGECKO",
          confidence: "high",
          metadata: {
            seeded: true,
          },
        },
      });
    }

    await prisma.subscription.upsert({
      where: { workspaceId: workspace.id },
      update: {
        plan: "FREE",
        status: "ACTIVE",
        seatCount: 1,
      },
      create: {
        workspaceId: workspace.id,
        plan: "FREE",
        status: "ACTIVE",
        seatCount: 1,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        portfolioId: portfolio.id,
        userId: user.id,
        integrationId: integration.id,
        actorType: "SYSTEM",
        action: "seed.run",
        entityType: "workspace",
        entityId: workspace.id,
        severity: "INFO",
        message: "Seeded SaaS foundation demo records.",
        payload: {
          workspaceSlug: workspace.slug,
          portfolioSlug: portfolio.slug,
          credentialsEmail: user.email,
          credentialsPassword: "DemoPass123!",
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  throw error;
});