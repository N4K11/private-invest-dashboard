import "server-only";

import type { AssetCategory } from "@prisma/client";

import { canManagePortfolio } from "@/lib/auth/authorization";
import {
  getPortfolioMembershipForUser,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import { assertWorkspaceCountLimit } from "@/lib/saas/limits";
import type { ImportCommitRequest } from "@/lib/imports/schema";
import type { ImportAssetCategory, ImportCommitResult } from "@/types/imports";

function mapCategoryToPrisma(category: ImportAssetCategory): AssetCategory {
  switch (category) {
    case "cs2":
      return "CS2";
    case "telegram":
      return "TELEGRAM";
    case "crypto":
      return "CRYPTO";
    case "nft":
      return "NFT";
    default:
      return "CUSTOM";
  }
}

function mergeNotes(existing: string | null, incoming: string | null) {
  const unique = [...new Set([existing, incoming].map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  return unique.length > 0 ? unique.join(" | ") : null;
}

export async function commitImportToPortfolio(
  userId: string,
  input: ImportCommitRequest,
): Promise<ImportCommitResult> {
  const membership = await getPortfolioMembershipForUser(userId, input.portfolioId);

  if (!membership) {
    throw new Error("РџРѕСЂС‚С„РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РґРѕСЃС‚СѓРї Рє РЅРµРјСѓ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManagePortfolio(role)) {
    throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ РёРјРїРѕСЂС‚Р° РІ СЌС‚РѕС‚ РїРѕСЂС‚С„РµР»СЊ.");
  }

  const prisma = getPrismaClient();

  return prisma.$transaction(async (transaction) => {
    let createdAssetCount = 0;
    let updatedAssetCount = 0;
    let createdPositionCount = 0;
    let updatedPositionCount = 0;
    let importedRecordCount = 0;

    const dedupeKeys = [...new Set(input.records.filter((record) => record.quantity > 0).map((record) => record.dedupeKey))];
    if (dedupeKeys.length > 0) {
      const existingAssets = await transaction.asset.findMany({
        where: {
          workspaceId: membership.workspaceId,
          normalizedKey: {
            in: dedupeKeys,
          },
        },
        select: {
          id: true,
          normalizedKey: true,
        },
      });
      const assetByKey = new Map(existingAssets.map((asset) => [asset.normalizedKey, asset.id]));
      const existingPositionAssetIds = existingAssets.length > 0
        ? new Set(
            (
              await transaction.position.findMany({
                where: {
                  portfolioId: input.portfolioId,
                  assetId: {
                    in: existingAssets.map((asset) => asset.id),
                  },
                },
                select: {
                  assetId: true,
                },
              })
            ).map((position) => position.assetId),
          )
        : new Set<string>();

      const requestedNewPositions = dedupeKeys.reduce((sum, key) => {
        const assetId = assetByKey.get(key);
        return !assetId || !existingPositionAssetIds.has(assetId) ? sum + 1 : sum;
      }, 0);

      await assertWorkspaceCountLimit(membership.workspaceId, "positions", requestedNewPositions, transaction);
    }

    for (const record of input.records) {
      if (record.quantity <= 0) {
        continue;
      }

      importedRecordCount += 1;

      const asset = await transaction.asset.findUnique({
        where: {
          workspaceId_normalizedKey: {
            workspaceId: membership.workspaceId,
            normalizedKey: record.dedupeKey,
          },
        },
      });

      const assetMetadata = {
        import: {
          sourceType: input.sourceType,
          sourceLabel: input.sourceLabel,
          collection: record.collection,
          raw: record.raw,
          warnings: record.warnings,
          sourceRowIds: record.sourceRowIds,
        },
      };

      const persistedAsset = asset
        ? await transaction.asset.update({
            where: { id: asset.id },
            data: {
              name: record.name,
              symbol: record.symbol ?? asset.symbol,
              category: mapCategoryToPrisma(record.category),
              externalSource: record.externalSource ?? asset.externalSource,
              externalId: record.externalId ?? asset.externalId,
              metadata: assetMetadata,
            },
          })
        : await transaction.asset.create({
            data: {
              workspaceId: membership.workspaceId,
              category: mapCategoryToPrisma(record.category),
              name: record.name,
              symbol: record.symbol,
              normalizedKey: record.dedupeKey,
              externalSource: record.externalSource,
              externalId: record.externalId,
              metadata: assetMetadata,
            },
          });

      if (asset) {
        updatedAssetCount += 1;
      } else {
        createdAssetCount += 1;
      }

      const existingPosition = await transaction.position.findUnique({
        where: {
          portfolioId_assetId: {
            portfolioId: input.portfolioId,
            assetId: persistedAsset.id,
          },
        },
      });

      await transaction.position.upsert({
        where: {
          portfolioId_assetId: {
            portfolioId: input.portfolioId,
            assetId: persistedAsset.id,
          },
        },
        update: {
          quantity: String(record.quantity),
          averageEntryPrice:
            record.averageEntryPrice !== null
              ? String(record.averageEntryPrice)
              : existingPosition?.averageEntryPrice ?? undefined,
          currentPrice:
            record.currentPrice !== null
              ? String(record.currentPrice)
              : existingPosition?.currentPrice ?? undefined,
          priceSource: "IMPORTED",
          status: "ACTIVE",
          notes: mergeNotes(existingPosition?.notes ?? null, record.notes),
          metadata: {
            import: {
              sourceType: input.sourceType,
              sourceLabel: input.sourceLabel,
              sourceSummary: input.sourceSummary,
              importedAt: new Date().toISOString(),
              collection: record.collection,
              warnings: record.warnings,
            },
          },
        },
        create: {
          portfolioId: input.portfolioId,
          assetId: persistedAsset.id,
          quantity: String(record.quantity),
          averageEntryPrice:
            record.averageEntryPrice !== null ? String(record.averageEntryPrice) : null,
          currentPrice: record.currentPrice !== null ? String(record.currentPrice) : null,
          manualCurrentPrice: null,
          priceSource: "IMPORTED",
          status: "ACTIVE",
          notes: record.notes,
          metadata: {
            import: {
              sourceType: input.sourceType,
              sourceLabel: input.sourceLabel,
              sourceSummary: input.sourceSummary,
              importedAt: new Date().toISOString(),
              collection: record.collection,
              warnings: record.warnings,
            },
          },
        },
      });

      if (existingPosition) {
        updatedPositionCount += 1;
      } else {
        createdPositionCount += 1;
      }
    }

    const auditLog = await transaction.auditLog.create({
      data: {
        workspaceId: membership.workspaceId,
        portfolioId: input.portfolioId,
        userId,
        actorType: "USER",
        action: "import.run",
        entityType: "portfolio",
        entityId: input.portfolioId,
        severity: "INFO",
        message: "Imported holdings into portfolio from SaaS Import Center.",
        payload: {
          sourceType: input.sourceType,
          sourceLabel: input.sourceLabel,
          sourceSummary: input.sourceSummary,
          totalSourceRows: input.totalSourceRows,
          duplicateRowCount: input.duplicateRowCount,
          importedRecordCount,
          createdAssetCount,
          updatedAssetCount,
          createdPositionCount,
          updatedPositionCount,
          recordSample: input.records.slice(0, 10).map((record) => ({
            name: record.name,
            category: record.category,
            quantity: record.quantity,
          })),
        },
      },
    });

    return {
      importedRecordCount,
      createdAssetCount,
      updatedAssetCount,
      createdPositionCount,
      updatedPositionCount,
      auditLogId: auditLog.id,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
    };
  });
}
