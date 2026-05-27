import { readFileSync, writeFileSync } from "fs";

const file = "src/api/controllers/ChatController.ts";
let c = readFileSync(file, "utf8");

// ── 1. Add smart extraction helper after sanitizeUserMessage ──────────────────
const helper = `
function extractMessageProfile(msg) {
  const lower = msg.toLowerCase();

  // Skin type
  const skinMatch = lower.match(/\\b(dry|oily|combination|sensitive|normal)\\b/);
  const skinType = skinMatch ? skinMatch[1] : null;

  // Hair type — "curly hair", "my hair is dry", "dry hair"
  const hairMatch =
    lower.match(/\\b(dry|oily|normal|curly|fine|thick|straight|wavy)\\s+hair\\b/) ||
    lower.match(/\\bhair\\s+(?:is\\s+)?(dry|oily|normal|curly|fine|thick|straight|wavy)\\b/) ||
    lower.match(/\\b(curly|wavy|straight|fine|thick)\\b/);
  const hairType = hairMatch ? (hairMatch[1] ?? hairMatch[2] ?? null) : null;

  // Concerns — keyword list + French/Arabic variants
  const CONCERNS = [
    "redness","acne","aging","dullness","pores","wrinkles",
    "sensitivity","dehydration","hyperpigmentation","dark spots","dark circles",
    "rougeur","rides","taches","boutons","sensibilite","deshydratation"
  ];
  const skinConcerns = CONCERNS.filter(k => lower.includes(k));

  // Clear concerns — "no concern", "no skin concern", "sans souci"
  const clearConcerns = /no\\s+(skin\\s+)?concern|sans\\s+(souci|concern|problème)|aucune\\s+préoccupation|pas\\s+de\\s+(souci|problème)/i.test(msg);

  return { skinType, hairType, skinConcerns, clearConcerns };
}
`;

c = c.replace(
  "function detectLanguage(msg: string)",
  helper + "\nfunction detectLanguage(msg: string)"
);

// ── 2. Replace mismatch detection block ───────────────────────────────────────
c = c.replace(
  /const explicitSkinInMessage[\s\S]*?res\.end\(\);\s*return res;\s*\}/,
  `const extracted = extractMessageProfile(message);

      const profileSkinNormalized = (effectiveSkin ?? "").toLowerCase();
      const profileHairNormalized = (effectiveHair ?? "").toLowerCase();

      const skinMismatch  = extracted.skinType  && extracted.skinType  !== profileSkinNormalized;
      const hairMismatch  = extracted.hairType  && extracted.hairType  !== profileHairNormalized && effectiveHair;
      const hasMismatch   = (skinMismatch || hairMismatch) && userId;
      const messageMentionsDifferentSkin = !!skinMismatch; // keep for compat

      if (hasMismatch && !(await getPendingConfirmation(userId!))) {
        const changedFields: string[] = [];
        if (skinMismatch) changedFields.push(\`skin type to \${extracted.skinType}\`);
        if (hairMismatch) changedFields.push(\`hair type to \${extracted.hairType}\`);
        if (extracted.skinConcerns.length) changedFields.push(\`concerns: \${extracted.skinConcerns.join(", ")}\`);

        const confirmMsg =
          \`Just to confirm — is this for you? Your profile shows \${effectiveSkin ?? "unknown"} skin\` +
          \`\${effectiveConcerns.length ? \` with \${effectiveConcerns.join(", ")}\` : ""}. \` +
          \`Would you like me to update your profile (\${changedFields.join(", ")}), or is this for someone else?\`;

        await setPendingConfirmation(userId!, {
          field: "skinType",
          oldValue: effectiveSkin ?? "",
          newValue: extracted.skinType ?? effectiveSkin ?? "",
          newHairType: extracted.hairType ?? undefined,
          newConcerns: extracted.skinConcerns,
          clearConcerns: extracted.clearConcerns,
        });

        sseChunk({ token: confirmMsg });
        sseChunk({ done: true, logId: randomUUID() });
        res.end();
        return res;
      }`
);

// ── 3. Replace the confirm DB update block ────────────────────────────────────
c = c.replace(
  /if \(tbl && newSkin\) \{[\s\S]*?console\.log\("\[CHAT\] Profile updated.*?\);\s*\}/,
  `if (tbl) {
                const updatePayload: any = {};
                if (newSkin) updatePayload.skinType = newSkin;
                if (pending.newHairType) updatePayload.hairType = pending.newHairType;
                if (pending.clearConcerns) {
                  updatePayload.skinConcerns = "";
                } else if (pending.newConcerns?.length) {
                  const existing = (await db.select().from(tbl).where(eq(tbl.id, userId)).limit(1))[0] as any;
                  const existingConcerns = (existing?.skinConcerns ?? "").split(",").filter(Boolean);
                  const merged = [...new Set([...existingConcerns, ...pending.newConcerns])].slice(0, 5);
                  updatePayload.skinConcerns = merged.join(",");
                }
                if (Object.keys(updatePayload).length) {
                  await db.update(tbl).set(updatePayload).where(eq(tbl.id, userId));
                  await redis.del(\`skin:\${userId}\`);
                  console.log("[CHAT] Profile updated:", updatePayload);
                }
              }`
);

writeFileSync(file, c, "utf8");
console.log("Patch applied successfully");
