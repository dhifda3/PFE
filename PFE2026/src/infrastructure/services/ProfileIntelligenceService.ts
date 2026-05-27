import axios from "axios";
import { redis } from "../redis/index.js";
import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import * as authSchema from "../db/schema/auth.js";

const OLLAMA_URL   = (process.env.OLLAMA_URL  || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral-nemo:12b";
const PENDING_TTL  = 600;

export interface ExtractedProfile {
  skinType?:     string | null;
  hairType?:     string | null;
  skinConcerns?: string[];
  confidence:    number;
}

const EXTRACT_SYSTEM = `You are a silent profile extractor for a beauty app.
Given a user message, extract ONLY what the user explicitly states about themselves.
Return ONLY valid JSON - no explanation, no markdown.
Schema: {"skinType":"oily|dry|combination|normal|sensitive|null","hairType":"dry|oily|normal|curly|fine|null","skinConcerns":[],"confidence":0.0}
confidence: 0.9=explicit ("my skin is oily"), 0.6=implied ("I break out a lot"), 0.3=very vague.
skinConcerns allowed values: ["acne","aging","dullness","hyperpigmentation","dehydration","redness","pores","wrinkles","dark spots","sensitivity"]
Set skinType/hairType to null if not mentioned.`;

function userTable() {
  return (authSchema as any).users || (authSchema as any).user;
}

async function logChange(userId: string, source: string, changes: Record<string, unknown>) {
  try {
    const entry = JSON.stringify({ userId, source, changes, ts: Date.now() });
    await (redis as any).lpush("profile_update_log", entry);
    await (redis as any).ltrim("profile_update_log", 0, 4999);
  } catch {}
}

export async function extractProfileFromMessage(userMessage: string): Promise<ExtractedProfile | null> {
  try {
    const res = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user",   content: `User said: "${userMessage.slice(0, 300)}"` }
      ],
      stream: false,
      options: { temperature: 0.05, num_predict: 120 }
    }, { timeout: 7000 });
    const raw = (res.data?.message?.content ?? "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed?.confidence !== "number") return null;
    return parsed as ExtractedProfile;
  } catch { return null; }
}

export async function handleProfileUpdate(
  userId: string,
  extracted: ExtractedProfile
): Promise<{ needsConfirmation: boolean; field?: string; oldValue?: string; newValue?: string }> {
  if (!userId || extracted.confidence < 0.35) return { needsConfirmation: false };

  const tbl = userTable();
  if (!tbl) return { needsConfirmation: false };
  const rows = await db.select().from(tbl).where(eq(tbl.id, userId)).limit(1);
  if (!rows.length) return { needsConfirmation: false };
  const u = rows[0] as any;
  const dbSkin = (u.skinType ?? u.skin_type ?? "").toLowerCase() || null;
  const dbHair = (u.hairType ?? u.hair_type ?? "").toLowerCase() || null;

  // Auto-write disabled — all updates go through explicit confirmation flow
  // High confidence direct write intentionally removed

  // Medium confidence + conflict → store pending confirmation
  const checkField = async (field: "skinType" | "hairType", newVal: string | null | undefined, dbVal: string | null) => {
    if (!newVal || newVal === "null") return false;
    if (dbVal && dbVal !== newVal.toLowerCase()) {
      await redis.setex(`profile_pending:${userId}`, PENDING_TTL, JSON.stringify({
        field, newValue: newVal, oldValue: dbVal, confidence: extracted.confidence
      }));
      return true;
    }
    if (!dbVal && extracted.confidence >= 0.6) {
      await db.update(tbl).set({ [field]: newVal } as any).where(eq(tbl.id, userId));
      await redis.del(`skin:${userId}`);
      await logChange(userId, "chat_fill", { [field]: newVal });
    }
    return false;
  };

  if (await checkField("skinType", extracted.skinType, dbSkin)) {
    const p = JSON.parse((await redis.get(`profile_pending:${userId}`))!);
    return { needsConfirmation: true, field: p.field, oldValue: p.oldValue, newValue: p.newValue };
  }
  if (await checkField("hairType", extracted.hairType, dbHair)) {
    const p = JSON.parse((await redis.get(`profile_pending:${userId}`))!);
    return { needsConfirmation: true, field: p.field, oldValue: p.oldValue, newValue: p.newValue };
  }

  // Concerns only — merge without confirmation
  if (extracted.skinConcerns?.length && extracted.confidence >= 0.6) {
    const existing = (u.skinConcerns ?? u.skin_concerns ?? "").split(",").filter(Boolean);
    const merged   = [...new Set([...existing, ...extracted.skinConcerns])].slice(0, 5);
    await db.update(tbl).set({ skinConcerns: merged.join(",") } as any).where(eq(tbl.id, userId));
    await redis.del(`skin:${userId}`);
    await logChange(userId, "chat_concerns", { skinConcerns: merged });
  }
  return { needsConfirmation: false };
}

export async function setPendingConfirmation(
  userId: string,
  pending: {
    field: string;
    oldValue: string;
    newValue: string;
    newConcerns?: string[];
    newHairType?: string;
    clearConcerns?: boolean;
  }
) {
  await redis.setex(`profile_pending:${userId}`, PENDING_TTL, JSON.stringify({
    field:         pending.field,
    newValue:      pending.newValue,
    oldValue:      pending.oldValue,
    newConcerns:   pending.newConcerns   ?? [],
    newHairType:   pending.newHairType   ?? null,
    clearConcerns: pending.clearConcerns ?? false,
    confidence:    0.99,
  }));
}

export async function getPendingConfirmation(userId: string) {
  const raw = await redis.get(`profile_pending:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function resolvePendingConfirmation(userId: string, confirmed: boolean) {
  const raw = await redis.get(`profile_pending:${userId}`);
  if (!raw) return;
  const pending = JSON.parse(raw);
  await redis.del(`profile_pending:${userId}`);
  if (!confirmed) return;
  const tbl = userTable();
  if (tbl) {
    await db.update(tbl).set({ [pending.field]: pending.newValue } as any).where(eq(tbl.id, userId));
    await redis.del(`skin:${userId}`);
    await logChange(userId, "chat_confirmed", { [pending.field]: pending.newValue });
  }
}
