// src/services/animal-listing-data.service.ts
// Shared service for populating animal listing data from dataDrawerConfig.
// Used by public endpoints: breeding services, individual listings, etc.

import prisma from "../prisma.js";
import { getPublicCdnUrl } from "./media-storage.js";
import {
  applyImageWatermark,
  isImageMimeType,
  resolveTemplateVars,
} from "./watermark-service.js";

/**
 * Optional privacy settings from the animal's privacy configuration.
 * When provided, sections are only included if BOTH config and privacy allow.
 * When not provided, sections are included based on config alone (breeding services).
 */
interface AnimalPrivacySettings {
  enableHealthSharing?: boolean | null;
  enableGeneticsSharing?: boolean | null;
  showRegistryFull?: boolean | null;
  showTitles?: boolean | null;
  enableMediaSharing?: boolean | null;
  enableDocumentSharing?: boolean | null;
  showBreedingHistory?: boolean | null;
}

/**
 * Populate animal data based on dataDrawerConfig settings.
 *
 * Fetches genetics, lineage, achievements, health, registry, breeding,
 * documents, and media data filtered by config flags and optional privacy.
 *
 * Each section is independently try/catch'd so one section's failure
 * does not prevent other sections from populating.
 *
 * @param animalId - The animal record ID
 * @param tenantId - The tenant (breeder organization) ID
 * @param config - The dataDrawerConfig JSON from the listing
 * @param privacySettings - Optional animal-level privacy settings
 */
export async function populateAnimalDataFromConfig(
  animalId: number,
  tenantId: number,
  config: any,
  privacySettings?: AnimalPrivacySettings | null
): Promise<any> {
  const result: any = {};

  // Helper: check if section is allowed by both config and privacy
  const isSectionAllowed = (
    configSection: any,
    privacyFlag?: boolean | null
  ): boolean => {
    if (!configSection?.enabled) return false;
    // When privacy settings are provided, the privacy flag must also be true
    if (privacySettings && privacyFlag !== undefined && privacyFlag !== null) {
      return privacyFlag === true;
    }
    return true;
  };

  // ── Genetics ──────────────────────────────────────────────────────
  if (isSectionAllowed(config.genetics, privacySettings?.enableGeneticsSharing)) {
    try {
      const geneticsData = await prisma.animalGenetics.findFirst({
        where: { animalId },
      });

      if (geneticsData) {
        result.genetics = {};

        // Test Results (Provider, Date, ID)
        if (config.genetics.showTestResults !== false) {
          if (geneticsData.testProvider) {
            result.genetics.testProvider = geneticsData.testProvider;
          }
          if (geneticsData.testDate) {
            result.genetics.testDate = geneticsData.testDate;
          }
          if (geneticsData.testId) {
            result.genetics.testId = geneticsData.testId;
          }
        }

        if (config.genetics.showBreedComposition && geneticsData.breedComposition) {
          result.genetics.breedComposition = geneticsData.breedComposition;
        }

        // Genetic Diversity (COI + MHC)
        if (config.genetics.showGeneticDiversity !== false) {
          if (geneticsData.coi) {
            const coiData = geneticsData.coi as any;
            result.genetics.coi = coiData.percentage || coiData.coefficient || null;
          }
          if (geneticsData.mhcDiversity) {
            result.genetics.mhcDiversity = geneticsData.mhcDiversity;
          }
        } else if (config.genetics.showCOI && geneticsData.coi) {
          // Legacy fallback: showCOI without showGeneticDiversity
          const coiData = geneticsData.coi as any;
          result.genetics.coi = coiData.percentage || coiData.coefficient || null;
        }

        if (config.genetics.showPredictedWeight && geneticsData.predictedAdultWeight) {
          const weightData = geneticsData.predictedAdultWeight as any;
          result.genetics.predictedWeight = weightData.value
            ? `${weightData.value} ${weightData.unit || "lbs"}`
            : null;
        }

        if (config.genetics.showHealthGenetics && geneticsData.healthGeneticsData) {
          const arr = geneticsData.healthGeneticsData as any[];
          result.genetics.healthGenetics = Array.isArray(arr)
            ? arr.filter((t: any) => t.networkVisible === true && t.genotype?.trim())
            : [];
        }

        // Additional locus categories - filter by privacy + non-empty genotype
        const filterLoci = (data: unknown) => {
          const arr = data as any[];
          if (!Array.isArray(arr)) return null;
          const filtered = arr.filter(
            (l: any) => l.networkVisible === true && l.genotype?.trim()
          );
          return filtered.length > 0 ? filtered : null;
        };

        result.genetics.coatType =
          config.genetics.showCoatType && geneticsData.coatTypeData
            ? filterLoci(geneticsData.coatTypeData)
            : null;

        result.genetics.physicalTraits =
          config.genetics.showPhysicalTraits && geneticsData.physicalTraitsData
            ? filterLoci(geneticsData.physicalTraitsData)
            : null;

        result.genetics.eyeColor =
          config.genetics.showEyeColor && geneticsData.eyeColorData
            ? filterLoci(geneticsData.eyeColorData)
            : null;

        result.genetics.performance =
          config.genetics.showPerformanceGenetics && geneticsData.performanceData
            ? filterLoci(geneticsData.performanceData)
            : null;

        result.genetics.temperament =
          config.genetics.showTemperamentGenetics && geneticsData.temperamentData
            ? filterLoci(geneticsData.temperamentData)
            : null;

        result.genetics.otherTraits = geneticsData.otherTraitsData
          ? filterLoci(geneticsData.otherTraitsData)
          : null;
      }
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Genetics error for animal ${animalId}:`, err);
    }
  }

  // ── Lineage ───────────────────────────────────────────────────────
  if (config.lineage?.enabled) {
    try {
      const animal = await prisma.animal.findUnique({
        where: { id: animalId },
        select: { sireId: true, damId: true },
      });

      if (animal) {
        result.lineage = {};

        if (config.lineage.showSire && animal.sireId) {
          const sire = await prisma.animal.findUnique({
            where: { id: animal.sireId },
            select: { id: true, name: true, breed: true, photoUrl: true },
          });
          if (sire) result.lineage.sire = sire;
        }

        if (config.lineage.showDam && animal.damId) {
          const dam = await prisma.animal.findUnique({
            where: { id: animal.damId },
            select: { id: true, name: true, breed: true, photoUrl: true },
          });
          if (dam) result.lineage.dam = dam;
        }
      }
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Lineage error for animal ${animalId}:`, err);
    }
  }

  // ── Achievements ──────────────────────────────────────────────────
  if (isSectionAllowed(config.achievements, privacySettings?.showTitles)) {
    try {
      result.achievements = {};

      const titleIds = config.achievements.titleIds as number[] | undefined;
      const titles = await prisma.animalTitle.findMany({
        where: {
          animalId,
          isPublic: true,
          // Only filter by IDs if specific non-empty list provided
          ...(titleIds && titleIds.length > 0 && {
            id: { in: titleIds },
          }),
        },
        select: {
          id: true,
          titleDefinition: {
            select: { fullName: true, abbreviation: true },
          },
          createdAt: true,
        },
      });
      result.achievements.titles = titles.map((t) => ({
        id: t.id,
        name: t.titleDefinition?.fullName || "Unknown",
        abbreviation: t.titleDefinition?.abbreviation || "",
        date: t.createdAt?.toISOString().split("T")[0],
      }));

      const competitionIds = config.achievements.competitionIds as number[] | undefined;
      const competitions = await prisma.competitionEntry.findMany({
        where: {
          animalId,
          // Only filter by IDs if specific non-empty list provided
          ...(competitionIds && competitionIds.length > 0 && {
            id: { in: competitionIds },
          }),
        },
        select: {
          id: true,
          eventName: true,
          eventDate: true,
          placement: true,
          className: true,
        },
        orderBy: { eventDate: "desc" },
        take: 10,
      });
      result.achievements.competitions = competitions.map((c) => ({
        id: c.id,
        eventName: c.eventName,
        date: c.eventDate?.toISOString().split("T")[0],
        placement: c.placement,
        class: c.className,
      }));
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Achievements error for animal ${animalId}:`, err);
    }
  }

  // ── Health Clearances ─────────────────────────────────────────────
  if (isSectionAllowed(config.health, privacySettings?.enableHealthSharing)) {
    try {
      const traitIds = config.health.traitIds as number[] | undefined;

      // ALWAYS filter by networkVisible=true. The traitIds list from config may
      // contain ALL trait IDs (public + private). The per-trait networkVisible
      // toggle in the Health tab is the actual privacy gate.
      const whereClause: any = { animalId, networkVisible: true };
      if (traitIds && traitIds.length > 0) {
        whereClause.id = { in: traitIds };
      }

      // Fetch trait values with definition metadata
      const healthTraits = await prisma.animalTraitValue.findMany({
        where: whereClause,
        select: {
          id: true,
          traitDefinitionId: true,
          valueBoolean: true,
          valueNumber: true,
          valueText: true,
          valueDate: true,
          valueJson: true,
          status: true,
          performedAt: true,
          source: true,
          verified: true,
          networkVisible: true,
          traitDefinition: {
            select: {
              id: true,
              key: true,
              displayName: true,
              category: true,
              valueType: true,
              enumValues: true,
              supportsHistory: true,
            },
          },
          // Include attached evidence documents (via bridge table)
          // Only include documents that are PUBLIC or BUYERS visibility
          documents: {
            where: {
              document: {
                visibility: { in: ["PUBLIC", "BUYERS"] },
              },
            },
            select: {
              document: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  storageKey: true,
                  mimeType: true,
                  originalFileName: true,
                  visibility: true,
                  watermarkEnabled: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      const HEALTH_CATEGORIES = [
        "General", "Orthopedic", "Eyes", "Cardiac",
        "Infectious", "Preventative", "Reproductive",
        "health", "health_testing",
      ];

      // Filter to health-only categories first (exclude Genetic)
      const healthOnlyTraits = healthTraits.filter((t) =>
        HEALTH_CATEGORIES.includes(t.traitDefinition.category)
      );

      // Count history entries per trait definition for this animal.
      // Some traits (Weight, Lameness Exam, Coggins Status, Breeding Soundness)
      // store their data in AnimalTraitEntry records, not direct value fields.
      const traitDefIds = healthOnlyTraits.map((t) => t.traitDefinitionId);
      const entryCounts = traitDefIds.length > 0
        ? await prisma.animalTraitEntry.groupBy({
            by: ["traitDefinitionId"],
            where: {
              animalId,
              traitDefinitionId: { in: traitDefIds },
            },
            _count: { id: true },
          })
        : [];
      const entryCountMap = new Map(
        entryCounts.map((e) => [e.traitDefinitionId, e._count.id])
      );

      // Golden Rule #3: Only include traits that actually have data.
      // A trait "has data" if it has direct value fields OR history entries.
      const traitsWithData = healthOnlyTraits.filter((t) => {
        const hasDirectData =
          t.valueBoolean !== null ||
          t.valueNumber !== null ||
          (t.valueText !== null && t.valueText.trim() !== "") ||
          t.valueDate !== null ||
          t.valueJson !== null ||
          (t.status !== null && t.status !== "NOT_PROVIDED");

        const historyCount = entryCountMap.get(t.traitDefinitionId) || 0;

        return hasDirectData || historyCount > 0;
      });

      // Fetch latest history entry per trait for display.
      // HealthTraitCard checks trait.history[0] (not historyCount) to determine
      // the display value and green/red dot. Without actual entries, history-only
      // traits (Weight, Lameness Exam, Coggins, Breeding Soundness) show red dots.
      const traitDefsWithHistory = traitsWithData
        .filter((t) => t.traitDefinition.supportsHistory && (entryCountMap.get(t.traitDefinitionId) || 0) > 0)
        .map((t) => t.traitDefinitionId);

      const latestEntriesMap = new Map<number, any>();
      if (traitDefsWithHistory.length > 0) {
        const allEntries = await prisma.animalTraitEntry.findMany({
          where: {
            animalId,
            traitDefinitionId: { in: traitDefsWithHistory },
          },
          select: {
            id: true,
            traitDefinitionId: true,
            recordedAt: true,
            data: true,
            performedBy: true,
            location: true,
            notes: true,
          },
          orderBy: { recordedAt: "desc" },
        });
        // Keep only the latest entry per traitDefinitionId
        for (const entry of allEntries) {
          if (!latestEntriesMap.has(entry.traitDefinitionId)) {
            latestEntriesMap.set(entry.traitDefinitionId, entry);
          }
        }
      }

      // ── Pre-process document watermarks for images ──────────────
      // For public listing data, apply server-side watermarks to image documents
      // that have watermarking enabled. Ensures the actual image file served
      // to marketplace viewers contains the watermark (not just CSS overlay).
      const allDocEntries = traitsWithData.flatMap((t) =>
        (t.documents || []).map((d: any) => d.document)
      );
      const watermarkableDocs = allDocEntries.filter(
        (doc: any) => doc.watermarkEnabled && doc.storageKey && isImageMimeType(doc.mimeType)
      );

      let watermarkUrlMap = new Map<number, string>();
      if (watermarkableDocs.length > 0) {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { watermarkSettings: true, name: true },
          });
          const wmSettings = tenant?.watermarkSettings as any;

          if (wmSettings?.enabled && wmSettings.imageWatermark) {
            const resolvedText = resolveTemplateVars(
              wmSettings.imageWatermark.text,
              tenant?.name || ""
            );
            const wmOptions = {
              type: wmSettings.imageWatermark.type || "text",
              text: resolvedText,
              position: wmSettings.imageWatermark.position || "center",
              opacity: wmSettings.imageWatermark.opacity ?? 0.3,
              size: wmSettings.imageWatermark.size || "medium",
              pattern: wmSettings.imageWatermark.pattern,
              positions: wmSettings.imageWatermark.positions,
            };

            // Process all watermarkable documents in parallel (cache-first)
            const results = await Promise.all(
              watermarkableDocs.map(async (doc: any) => {
                try {
                  const { watermarkedKey } = await applyImageWatermark(
                    tenantId,
                    doc.storageKey,
                    wmOptions as any
                  );
                  return { docId: doc.id as number, url: getPublicCdnUrl(watermarkedKey) };
                } catch (wmErr) {
                  console.error(`[populateAnimalDataFromConfig] Watermark error doc ${doc.id}:`, wmErr);
                  return null;
                }
              })
            );

            watermarkUrlMap = new Map(
              results.filter(Boolean).map((r) => [r!.docId, r!.url])
            );
          }
        } catch (wmSetupErr) {
          console.error(`[populateAnimalDataFromConfig] Watermark setup error:`, wmSetupErr);
        }
      }

      // Group by category into HealthData format (matches HealthView types)
      const categoryMap: Record<string, any[]> = {};
      for (const t of traitsWithData) {
        const cat = t.traitDefinition.category;
        if (!categoryMap[cat]) categoryMap[cat] = [];

        const historyCount = entryCountMap.get(t.traitDefinitionId) || 0;
        const latestEntry = latestEntriesMap.get(t.traitDefinitionId);
        const history = latestEntry
          ? [{
              id: latestEntry.id,
              recordedAt: latestEntry.recordedAt.toISOString(),
              data: latestEntry.data as Record<string, any>,
              ...(latestEntry.performedBy && { performedBy: latestEntry.performedBy }),
              ...(latestEntry.location && { location: latestEntry.location }),
              ...(latestEntry.notes && { notes: latestEntry.notes }),
            }]
          : undefined;

        categoryMap[cat].push({
          id: t.id,
          traitKey: t.traitDefinition.key,
          traitValueId: t.id,
          displayName: t.traitDefinition.displayName,
          valueType: t.traitDefinition.valueType,
          enumOptions: t.traitDefinition.enumValues
            ? (t.traitDefinition.enumValues as string[])
            : undefined,
          value: {
            ...(t.valueBoolean !== null && { boolean: t.valueBoolean }),
            ...(t.valueText !== null && { text: t.valueText }),
            ...(t.valueNumber !== null && { number: t.valueNumber }),
            ...(t.valueDate !== null && { date: t.valueDate.toISOString() }),
            ...(t.valueJson !== null && { json: t.valueJson }),
          },
          supportsHistory: t.traitDefinition.supportsHistory,
          historyCount,
          history,
          networkVisible: t.networkVisible ?? true,
          // Evidence documents attached to this trait value (already filtered to PUBLIC/BUYERS)
          // Use pre-watermarked URL for images when available, else fall back to raw CDN URL
          documents: (t.documents || []).map((d: any) => {
            const wmUrl = watermarkUrlMap.get(d.document.id);
            const resolvedUrl = wmUrl || (d.document.storageKey
              ? getPublicCdnUrl(d.document.storageKey)
              : d.document.url || "");
            return {
              id: d.document.id,
              name: d.document.title || d.document.originalFileName || "Document",
              url: resolvedUrl,
              type: d.document.mimeType,
              visibility: d.document.visibility || "PRIVATE",
              uploadedAt: d.document.createdAt?.toISOString(),
            };
          }),
          ...(t.source && { source: t.source }),
          ...(t.performedAt && { performedAt: t.performedAt.toISOString() }),
          verified: t.verified,
        });
      }

      // Sort categories in standard order (matches HealthView/Commerce rendering)
      const CATEGORY_ORDER = [
        "General", "Orthopedic", "Eyes", "Cardiac",
        "Infectious", "Preventative", "Reproductive",
      ];
      const categories = Object.entries(categoryMap)
        .map(([category, items]) => ({ category, items }))
        .sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.category);
          const bi = CATEGORY_ORDER.indexOf(b.category);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      // ── Vaccinations (part of health section) ──────────────────────
      // Fetch vaccination records and filter by per-protocol visibility settings.
      // vaccinationVisibility is a JSON map: { "dog.rabies": true, "dog.dhpp": false }
      // Only include protocols explicitly set to visible.
      let vaccinations: any[] = [];
      try {
        // Look up vaccination visibility from privacy settings
        const privacyRow = await prisma.animalPrivacySettings.findUnique({
          where: { animalId },
          select: { vaccinationVisibility: true },
        });
        const vacVisibility = (privacyRow?.vaccinationVisibility as Record<string, boolean>) || {};

        // Determine which protocol keys are visible
        const visibleProtocolKeys = Object.entries(vacVisibility)
          .filter(([, visible]) => visible === true)
          .map(([key]) => key);

        if (visibleProtocolKeys.length > 0) {
          const vacRecords = await prisma.vaccinationRecord.findMany({
            where: {
              animalId,
              protocolKey: { in: visibleProtocolKeys },
            },
            select: {
              id: true,
              protocolKey: true,
              administeredAt: true,
              expiresAt: true,
              veterinarian: true,
              clinic: true,
              batchLotNumber: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { administeredAt: "desc" },
          });

          const now = new Date();
          vaccinations = vacRecords.map((r) => {
            let status = "current";
            let daysRemaining = 0;
            if (r.expiresAt) {
              const diffMs = r.expiresAt.getTime() - now.getTime();
              daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              if (daysRemaining < 0) status = "expired";
              else if (daysRemaining <= 30) status = "due_soon";
            }
            return {
              id: r.id,
              animalId,
              protocolKey: r.protocolKey,
              administeredAt: r.administeredAt.toISOString(),
              expiresAt: r.expiresAt?.toISOString() || "",
              ...(r.veterinarian && { veterinarian: r.veterinarian }),
              ...(r.clinic && { clinic: r.clinic }),
              ...(r.batchLotNumber && { batchLotNumber: r.batchLotNumber }),
              ...(r.notes && { notes: r.notes }),
              status,
              daysRemaining,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
            };
          });
        }
      } catch (vacErr) {
        console.error(`[populateAnimalDataFromConfig] Vaccination error for animal ${animalId}:`, vacErr);
      }

      result.health = {
        categories,
        vaccinations,
      };
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Health error for animal ${animalId}:`, err);
    }
  }

  // ── Registry ──────────────────────────────────────────────────────
  if (isSectionAllowed(config.registry, privacySettings?.showRegistryFull)) {
    try {
      const registryIds = config.registry.registryIds as number[] | undefined;
      const registrations = await prisma.animalRegistryIdentifier.findMany({
        where: {
          animalId,
          ...(registryIds && registryIds.length > 0 && {
            id: { in: registryIds },
          }),
        },
        select: {
          id: true,
          identifier: true,
          registry: { select: { name: true } },
          verification: { select: { id: true } },
        },
      });

      result.registry = {
        registrations: registrations.map((r) => ({
          id: r.id,
          number: r.identifier,
          organization: r.registry.name,
          verified: !!r.verification,
        })),
      };
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Registry error for animal ${animalId}:`, err);
    }
  }

  // ── Breeding ──────────────────────────────────────────────────────
  if (isSectionAllowed(config.breeding, privacySettings?.showBreedingHistory)) {
    try {
      if (config.breeding.showOffspringCount) {
        const offspringCount = await prisma.animal.count({
          where: {
            OR: [{ sireId: animalId }, { damId: animalId }],
          },
        });
        result.breeding = { offspringCount };
      }
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Breeding error for animal ${animalId}:`, err);
    }
  }

  // ── Documents ─────────────────────────────────────────────────────
  if (isSectionAllowed(config.documents, privacySettings?.enableDocumentSharing)) {
    try {
      const documentIds = config.documents.documentIds as number[] | undefined;
      const documents = await prisma.document.findMany({
        where: {
          animalId,
          visibility: "PUBLIC",
          ...(documentIds && documentIds.length > 0 && {
            id: { in: documentIds },
          }),
        },
        select: {
          id: true,
          title: true,
          kind: true,
          url: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      result.documents = {
        items: documents.map((d) => ({
          id: d.id,
          name: d.title,
          type: d.kind,
          url: d.url,
          fileType: d.mimeType,
          uploadedAt: d.createdAt?.toISOString(),
        })),
      };
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Documents error for animal ${animalId}:`, err);
    }
  }

  // ── Media ─────────────────────────────────────────────────────────
  if (isSectionAllowed(config.media, privacySettings?.enableMediaSharing)) {
    try {
      const mediaIds = config.media.mediaIds as number[] | undefined;
      const media = await prisma.attachment.findMany({
        where: {
          animalId,
          ...(mediaIds && mediaIds.length > 0 && {
            id: { in: mediaIds },
          }),
        },
        select: {
          id: true,
          storageKey: true,
          kind: true,
          filename: true,
          mime: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      result.media = {
        items: media.map((m) => ({
          id: m.id,
          url: m.storageKey,
          type: m.kind,
          filename: m.filename,
          mimeType: m.mime,
          uploadedAt: m.createdAt?.toISOString(),
        })),
      };
    } catch (err) {
      console.error(`[populateAnimalDataFromConfig] Media error for animal ${animalId}:`, err);
    }
  }

  return result;
}
