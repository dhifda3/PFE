import { Service } from "typedi";
import { db } from "../../../infrastructure/db/index.js";
import { products } from "../../../infrastructure/db/schema/products.js";
import { user } from "../../../infrastructure/db/schema/auth.js";
import { userSignals } from "../../../infrastructure/db/schema/userSignals.js";
import { eq, inArray } from "drizzle-orm";

export interface GetRecommendationsRequest {
  userId: string;
  limit?: number;
}

const RAG_URL = process.env.RAG_URL || "http://localhost:8001";

@Service()
export class GetRecommendationsUseCase {
  async execute({ userId, limit = 8 }: GetRecommendationsRequest) {
    try {
      const users = await db.select().from(user).where(eq(user.id, userId));
      if (!users.length) return { success: false, data: [] };
      const u = users[0] as any;
      const skinType     = (u.skinType     ?? u.skin_type)?.toLowerCase()     ?? null;
      const skinConcerns = (u.skinConcerns ?? u.skin_concerns)?.toLowerCase() ?? null;
      const hairType     = (u.hairType     ?? u.hair_type)?.toLowerCase()     ?? null;

      const [allProducts, mySignals] = await Promise.all([
        db.select().from(products).where(eq(products.isActive, true)),
        db.select().from(userSignals).where(eq(userSignals.userId, userId)),
      ]);

      const mySignalMap: Record<string, number> = {};
      for (const s of mySignals) {
        if (s.productId)
          mySignalMap[s.productId] = (mySignalMap[s.productId] ?? 0) + s.weight;
      }

      const collabMap: Record<string, number> = {};
      try {
        const [bySkin, byHair] = await Promise.all([
          skinType ? db.select({ id: user.id }).from(user).where(eq((user as any).skinType, skinType)).limit(200) : Promise.resolve([]),
          hairType ? db.select({ id: user.id }).from(user).where(eq((user as any).hairType, hairType)).limit(200) : Promise.resolve([]),
        ]);
        const similarIds = [...new Set([...bySkin, ...byHair].map(su => su.id))].filter(id => id !== userId);
        if (similarIds.length > 0) {
          const theirSignals = await db.select().from(userSignals).where(inArray(userSignals.userId, similarIds));
          for (const s of theirSignals) {
            if (s.productId && s.weight >= 3)
              collabMap[s.productId] = (collabMap[s.productId] ?? 0) + 1;
          }
        }
      } catch { /* non-fatal */ }

      const ragBoostIds = new Set<string>();
      try {
        const query = [skinConcerns, skinType, hairType].filter(Boolean).join(" ");
        if (query) {
          const r = await fetch(`${RAG_URL}/search?q=${encodeURIComponent(query)}&limit=6`,
            { signal: AbortSignal.timeout(3000), headers: { Authorization: `Bearer ${process.env.RAG_SERVICE_TOKEN ?? ""}` } });
          if (r.ok) {
            const data = await r.json() as { results: { id: string }[] };
            data.results.forEach(item => item.id && ragBoostIds.add(item.id));
          }
        }
      } catch { /* non-fatal */ }

      const concernKeywords: Record<string, string[]> = {
        acne:              ["acne","blemish","salicylic","breakout","pore","antibacterial"],
        aging:             ["anti-age","antiage","anti-aging","retinol","collagen","firming","wrinkle"],
        dullness:          ["radiance","glow","brightening","vitamin c","eclat","luminous"],
        hyperpigmentation: ["dark spot","hyperpigmentation","niacinamide","depigment"],
        dehydration:       ["hydrat","moistur","hyaluronic","water","dehydrat"],
        redness:           ["calm","sooth","sensitive","redness","rosacea","aloe"],
      };
      const hairKeywords: Record<string, string[]> = {
        dry:    ["dry hair","frizz","brittle","nourish","argan","capillair","damaged"],
        oily:   ["oily hair","greasy","scalp","purif","sebum","buildup"],
        curly:  ["curl","coil","wavy","define"],
        fine:   ["volume","fine hair","thin hair","lightweight","lift"],
        normal: ["hair","capillair","shine","strengthen"],
      };

      const scored = allProducts.map((p) => {
        let score = 0;
        const text = ((p.description ?? "") + " " + (p.name ?? "")).toLowerCase();
        const skinTypeArr: string[] = Array.isArray((p as any).skinType)
          ? (p as any).skinType.map((s: string) => s.toLowerCase())
          : [];

        const isHairProduct = skinTypeArr.some(t => t.startsWith("hair:"));

        // Content-based: skin match +4
        if (!isHairProduct && skinType && skinTypeArr.includes(skinType)) score += 4;

        // Content-based: hair match +4 (mirrors skin match)
        if (isHairProduct && hairType && skinTypeArr.includes(`hair:${hairType}`)) score += 4;

        // Concern keywords +2 each hit
        if (skinConcerns) {
          const kws = concernKeywords[skinConcerns] ?? [skinConcerns];
          kws.forEach(kw => { if (text.includes(kw)) score += 2; });
        }

        // Hair keywords +1 each hit
        if (hairType) {
          const hkws = hairKeywords[hairType] ?? [hairType];
          hkws.forEach(kw => { if (text.includes(kw)) score += 1; });
        }

        score += parseFloat((p as any).averageRating ?? "0") * 0.5;
        score += Math.min(mySignalMap[p.id] ?? 0, 5);
        score += Math.min((collabMap[p.id] ?? 0) * 2, 3);
        if (ragBoostIds.has(p.id)) score += 3;

        return { ...p, _score: score };
      });

      const recommended = scored
        .sort((a, b) => b._score - a._score)
        .slice(0, limit)
        .map(({ _score, ...p }) => p);

      return { success: true, data: recommended };
    } catch (err) {
      return { success: false, data: [], error: (err as Error).message };
    }
  }
}
