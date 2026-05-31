// import { JsonController, Post, Body, Res, CurrentUser, UseBefore } from "routing-controllers";
// import { promptInjectionGuard } from "../middlewares/promptInjectionGuard.js";
// import { Response } from "express";
// import { Service, Inject } from "typedi";
// import axios from "axios";
// import { ragClient } from "../../infrastructure/services/RagHttpsClient.js";
// import { randomUUID } from "crypto";
// import { eq, desc, and } from "drizzle-orm";
// import { ChatMessageDto } from "../dtos/ChatMessageDto.js";
// import { redis } from "../../infrastructure/redis/index.js";
// import { db } from "../../infrastructure/db/index.js";
// import { conversationLogs } from "../../infrastructure/db/schema/conversationLogs.js";
// import * as authSchema from "../../infrastructure/db/schema/auth.js";
// import * as orderSchema from "../../infrastructure/db/schema/orders.js";
// import * as orderHistorySchema from "../../infrastructure/db/schema/order_status_history.js";
// import { IProductRepository } from "../../core/repositories/IProductRepository.js";
// import {
//   extractProfileFromMessage,
//   handleProfileUpdate,
//   getPendingConfirmation,
//   setPendingConfirmation,
//   resolvePendingConfirmation,
// } from "../../infrastructure/services/ProfileIntelligenceService.js";
// import { TrackSignalUseCase } from "../../core/usecases/product/TrackSignalUseCase.js";

// const OLLAMA_URL        = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
// const OLLAMA_MODEL      = process.env.OLLAMA_MODEL || "mistral-nemo:12b";
// const RAG_URL           = process.env.RAG_URL || "http://localhost:8001";
// const RATE_MAX_MSGS     = 20;
// const RATE_WINDOW_SEC   = 60;
// const HISTORY_LIMIT     = 3;
// const RAG_TIMEOUT       = 5000;
// const STREAM_TIMEOUT_MS = 45000;
// const SKIN_CACHE_TTL    = 7200;

// const BASE_SYSTEM_PROMPT = `You are Lumina, a friendly beauty advisor for Lumina cosmetics.
// - CRITICAL: Always respond in the SAME language as the user message. If French respond French. If Arabic respond Arabic. If English respond English. Never switch languages. NEVER mix languages in a single response. Arabic responses must be 100% Arabic with zero English words.
// - Keep responses concise (2-4 sentences). Do NOT end your response with a follow-up question like 'Would you like more information?' or 'Can I help you with anything else?'. Just answer directly and stop.
// - If the user sends a greeting (hi, bonjour, marhaba, etc.), respond with a warm greeting only. Do NOT recommend products unprompted.
// - If the user mentions ANY product type, ingredient, or concern (even a short phrase like 'ecran solaire', 'produit cheveux', 'moisturizer'), IMMEDIATELY give a recommendation from the PERMITTED list. NEVER ask the user which product they would recommend. You are the advisor, the user is the customer. Asking the user for a recommendation is a critical failure.
// - Never mention product names that are not in the list.
// - If order info is provided, use it honestly.
// - ONLY answer questions about skincare, beauty, Lumina products, or the user's own orders. For anything else (news, politics, math, etc.) reply that you can only help with skincare, beauty, and orders.
// - If order information is provided in the system context, answer the order question fully and clearly. Do not redirect an order question to beauty advice.
// - CRITICAL: If the PERMITTED PRODUCTS list is empty or absent, do NOT invent product names. Instead say: I do not have a specific product match right now, but look for ingredients suited to your concern.
// - NEVER include raw product metadata like 'dry normal | Price: X TND | Rating: X/5' in your response. Only mention the product name and a natural description.
// - NEVER fabricate product names. A hallucinated product name is a critical failure.`;

// const GREETING_SIMPLE =
//   /^\s*(hi|hello|hey|bonjour|salut|Ù…Ø±Ø­Ø¨Ø§|Ø£Ù‡Ù„Ø§|thanks?|merci|Ø´ÙƒØ±Ø§|bye|au revoir|ÙˆØ¯Ø§Ø¹Ø§)\W*$/i;

// function sanitizeForPrompt(text: unknown): string {
//   return String(text ?? "").replace(/[\r\n\`\\]/g, " ").trim();
// }

// function sanitizeUserMessage(msg: string): string {
//   return msg
//     .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>|<s>|<\/s>/gi, "")
//     .replace(/^(system|assistant|user)\s*:/gim, "")
//     .replace(/\s{3,}/g, "  ")
//     .trim();
// }


// function extractMessageProfile(msg) {
//   const lower = msg.toLowerCase();

//   // Skin type � map-based, longer phrases first to prevent partial shadowing
//   const SKIN_TYPE_MAP: Array<[string, string]> = [
//     ["peau grasse",   "oily"],  ["peau s\u00e8che",    "dry"],  ["peau seche",  "dry"],
//     ["peau mixte",    "combination"], ["peau sensible", "sensitive"], ["peau normale", "normal"],
//     ["grasse",        "oily"],  ["s\u00e8che",          "dry"],  ["seche",      "dry"],
//     ["mixte",         "combination"], ["sensible",      "sensitive"], ["normale",    "normal"],
//     ["dry",           "dry"],   ["oily",           "oily"], ["combination","combination"],
//     ["sensitive",     "sensitive"], ["normal",        "normal"],
//   ];
//   let skinType: string | null = null;
//   for (const [term, val] of SKIN_TYPE_MAP) {
//     if (lower.includes(term)) { skinType = val; break; }
//   }

//   // Hair type � French first (longer phrases before short ones), then English
//   const HAIR_FR_MAP: Array<[string, string]> = [
//     ["cheveux gras",    "oily"],   ["cheveux sec",     "dry"],  ["cheveux secs",    "dry"],
//     ["cheveux seche",   "dry"],    ["cheveux boucl�",  "curly"],["cheveux boucle",  "curly"],
//     ["cheveux fris�",   "curly"],  ["cheveux frises",  "curly"],["cheveux epais",   "thick"],
//     ["cheveux �pais",   "thick"],  ["cheveux fins",    "fine"], ["cheveux fin",     "fine"],
//     ["cheveux ondul�",  "wavy"],   ["cheveux lisse",   "straight"],["cheveux raide","straight"],
//     ["cheveux normal",  "normal"],
//   ];
//   let hairType: string | null = null;
//   for (const [term, val] of HAIR_FR_MAP) {
//     if (lower.includes(term)) { hairType = val; break; }
//   }
//   if (!hairType) {
//     const hairMatch =
//       lower.match(/\b(dry|oily|normal|curly|fine|thick|straight|wavy)\s+hair\b/) ||
//       lower.match(/\bhair\s+(?:is\s+)?(dry|oily|normal|curly|fine|thick|straight|wavy)\b/) ||
//       lower.match(/\b(curly|wavy|straight|fine|thick)\b/);
//     hairType = hairMatch ? (hairMatch[1] ?? hairMatch[2] ?? null) : null;
//   }

//   // Concerns � keyword list + French/Arabic variants
//   const CONCERNS = [
//     "redness","acne","aging","dullness","pores","wrinkles",
//     "sensitivity","dehydration","hyperpigmentation","dark spots","dark circles",
//     "rougeur","rides","taches","boutons","sensibilite","deshydratation"
//   ];
//   const skinConcerns = CONCERNS.filter(k => lower.includes(k));

//   // Clear concerns � "no concern", "no skin concern", "sans souci"
//   const clearConcerns = /no\s+(skin\s+)?concern|sans\s+(souci|concern|probl�me)|aucune\s+pr�occupation|pas\s+de\s+(souci|probl�me)/i.test(msg);

//   return { skinType, hairType, skinConcerns, clearConcerns };
// }

// async function detectLanguage(msg: string): Promise<"French" | "Arabic" | "English"> {
//   // Fast path: Arabic unicode block
//   if (/[\u0600-\u06FF\u0750-\u077F]/.test(msg)) return "Arabic";

//   // Too short for trigrams � franc returns "und" (undetermined) on <10 chars
//   if (msg.trim().length < 10) {
//     // Minimal keyword fallback only for ultra-short greetings
//     if (/\b(bonjour|salut|merci|oui|non)\b/i.test(msg)) return "French";
//     return "English";
//   }

//   const { franc } = await import("franc");
//   const detected = franc(msg, { only: ["fra", "eng", "arb"], minLength: 10 });

//   if (detected === "fra") return "French";
//   if (detected === "arb") return "Arabic";
//   return "English";
// }

// async function classifyUserIntent(
//   message: string,
//   pending: { field: string; oldValue: string; newValue: string }
// ): Promise<"confirm" | "deny" | "other"> {
//   try {
//     const res = await axios.post(
//       `${OLLAMA_URL}/api/chat`,
//       {
//         model: OLLAMA_MODEL,
//         stream: false,
//         options: { temperature: 0.0, num_predict: 80, num_ctx: 512 },
//         messages: [
//           {
//             role: "system",
//             content: `You are a semantic intent classifier for a beauty app. Output valid JSON only. No markdown, no explanation.`,
//           },
//           {
//             role: "user",
//             content:
//               `A beauty advisor asked: "Is your ${pending.field} ${pending.newValue}? ` +
//               `Your saved profile shows ${pending.oldValue}. Is this for you or someone else?"\n\n` +
//               `The user replied: "${message}"\n\n` +
//               `Determine intent based on MEANING, not keywords:\n` +
//               `- "confirm": user agrees this applies to THEMSELVES, or wants their own profile updated\n` +
//               `- "deny": user says this is for another person or explicitly rejects\n` +
//               `- "other": completely unrelated to the question\n\n` +
//               `Short replies (yes, oui, moi, me, sure, update it, its me) almost always mean confirm.\n` +
//               `Respond with JSON exactly: {"intent":"confirm","reason":"one sentence"}`,
//           },
//         ],
//       },
//       { timeout: 6000 }
//     );

//     const raw = (res.data?.message?.content ?? "")
//       .replace(/```json|```/g, "")
//       .trim();
//     const parsed = JSON.parse(raw);
//     const intent = (parsed?.intent ?? "").toLowerCase();
//     if (intent === "confirm") return "confirm";
//     if (intent === "deny")    return "deny";
//     return "other";

//   } catch {
//     const lower = message.toLowerCase();
//     const denyRe    = /\b(no|non|nope|not me|pas moi|pour mon|pour ma|friend|ami|frere|brother|sister|someone else|autre)\b/;
//     const confirmRe = /\b(yes|oui|yep|sure|ok|okay|update|me|moi|correct|right|yea|yeah|exactly)\b|c.?est moi|it.?s me/;
//     if (denyRe.test(lower))    return "deny";
//     if (confirmRe.test(lower)) return "confirm";
//     if (message.trim().split(/\s+/).length <= 5) return "confirm";
//     return "other";
//   }
// }


// const ORDER_RE = new RegExp(
//   [
//     // English
//     "\\b(order|orders|delivery|delivered|shipping|shipped|tracking|package|parcel|arrived|receipt|purchase|bought|status)\\b",
//     // French
//     "\\b(commande|commandes|livraison|livr�|exp�di�|suivi|colis|statut|achat|arriv�|re�u|exp�dition)\\b",
//     // Arabic roots � ??? (order) | ????? (delivery) | ??? (shipping) | ???? (tracking) | ??? (arrived)
//     "[\u0637\u0644\u0628]|[\u062a\u0633\u0644\u064a\u0645]|[\u0634\u062d\u0646]|[\u062a\u062a\u0628\u0639]|[\u0648\u0635\u0644]",
//   ].join("|"),
//   "i"
// );
 
// function isOrderQuery(message: string): boolean {
//   return ORDER_RE.test(message);
// }


// async function ollamaAnalyze(message: string): Promise<{
//   language: "French" | "Arabic" | "English";
//   isGreeting: boolean;
//   isOrderQuery: boolean;
//   skinType: string | null;
//   hairType: string | null;
//   skinConcerns: string[];
//   clearConcerns: boolean;
// }> {
//   try {
//     const res = await axios.post(
//       `${OLLAMA_URL}/api/chat`,
//       {
//         model: OLLAMA_MODEL,
//         stream: false,
//         options: { temperature: 0.0, num_predict: 250, num_ctx: 1024 },
//         messages: [
//           {
//             role: "system",
//             content: "You are a message analyzer. Output valid JSON only. No markdown, no explanation.",
//           },
//           {
//             role: "user",
//             content:
//               `Analyze this beauty-app message and return JSON with:\n` +
//               `- language: "French", "Arabic", or "English"\n` +
//               `- isGreeting: true only if the whole message is a greeting\n` +
//               `- isOrderQuery: true if the user asks about order/delivery/shipping/tracking\n` +
//               `- skinType: detected skin type, always in English: oily(gras/grasse), dry(sec/seche/s�che), combination(mixte), sensitive(sensible), normal(normale). null if not mentioned.\n` +
//               `- hairType: detected hair type, always in English: oily(gras), dry(sec/seche/s�che), curly(boucl�/boucle/fris�), wavy(ondul�), straight(lisse), fine(fin), thick(epais/�pais), normal. null if not mentioned.\n` +
//               `- skinConcerns: array from [acne,redness,aging,dark spots,wrinkles,dullness,pores,sensitivity,dehydration,hyperpigmentation] or []\n` +
//               `- clearConcerns: true if user explicitly says they have no concerns\n\n` +
//               `Message: "${message.replace(/"/g, '\\"').slice(0, 400)}"\n\nJSON only.`,
//           },
//         ],
//       },
//       { timeout: 6000 }
//     );
//     const raw = (res.data?.message?.content ?? "").replace(/```json|```/g, "").trim();
//     return JSON.parse(raw);
//   } catch {
//     const detected = await detectLanguage(message);
//     const ex = extractMessageProfile(message);
//     return {
//       language: detected as "French" | "Arabic" | "English",
//       isGreeting: GREETING_SIMPLE.test(message),
//       isOrderQuery: ORDER_RE.test(message),
//       skinType: ex.skinType,
//       hairType: ex.hairType,
//       skinConcerns: ex.skinConcerns,
//       clearConcerns: ex.clearConcerns,
//     };
//   }
// }
// @JsonController("/chat")
// @Service()
// export class ChatController {
//   @Inject("IProductRepository")
//   private productRepository!: IProductRepository;

//   @UseBefore(promptInjectionGuard)
//   @Post("/message")
//   async message(
//     @Body() body: ChatMessageDto,
//     @CurrentUser() currentUser: any,
//     @Res() res: Response
//   ) {
//     console.log("[CHAT] START | user:", currentUser?.id ?? "anon");

//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.setHeader("X-Accel-Buffering", "no");
//     res.flushHeaders();

//     const sseChunk = (data: Record<string, unknown>) =>
//       res.write(`data: ${JSON.stringify(data)}\n\n`);

//     const sender = body.sessionId || "anon";
//     const message = body.message?.trim() || "";

//     if (!message) {
//       sseChunk({ error: "Message is required." });
//       res.end();
//       return res;
//     }

//     // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//     // Rate limiting
//     // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

//     const rateLimitId = currentUser?.id ?? sender;
//     const rateKey = `chat_rate:${rateLimitId}`;

//     let count = 0;

//     try {
//       count = await redis.incr(rateKey);

//       if (count === 1) {
//         await redis.expire(rateKey, RATE_WINDOW_SEC);
//       }
//     } catch {}

//     if (count > RATE_MAX_MSGS) {
//       sseChunk({ error: "Too many messages. Please wait a moment." });
//       res.end();
//       return res;
//     }

//     let clientGone = false;

//     res.on("close", () => {
//       clientGone = true;
//     });

//     try {
//       const userId = currentUser?.id ?? null;


//       const detectedLang = await detectLanguage(message);
//       const langLabel = detectedLang === "auto"
//         ? "the same language as the user's message"
//         : detectedLang;

//       let pendingConfirmationCtx = "";
//       let ragOverrideSkin = "";

//       if (userId) {
//         const pending = await getPendingConfirmation(userId);

//         if (pending) {
//           const intent = await classifyUserIntent(message, pending);

//           if (intent === "confirm") {
//             await resolvePendingConfirmation(userId, true);
//             await redis.del(`skin:${userId}`);
//             const newSkin = pending.newValue ?? "";
//             try {
//               const tbl = (authSchema as any).users || (authSchema as any).user;
//               if (tbl) {
//                 const updatePayload: any = {};
//                 if (newSkin) updatePayload.skinType = newSkin;
//                 if (pending.newHairType) updatePayload.hairType = pending.newHairType;
//                 if (pending.clearConcerns) {
//                   updatePayload.skinConcerns = "";
//                 } else if (pending.newConcerns?.length) {
                  
//                   updatePayload.skinConcerns = pending.newConcerns.join(",");
//                 }
//                 if (Object.keys(updatePayload).length) {
//                   await db.update(tbl).set(updatePayload).where(eq(tbl.id, userId));
//                   await redis.del(`skin:${userId}`);
//                   console.log("[CHAT] Profile updated:", updatePayload);
//                 }
//               }
//             } catch (e) {
//               console.error("[CHAT] Profile update failed after confirm:", e);
//             }

//             let confirmedProducts = "";
//             try {
//               const ragRes = await ragClient.search(
//                 `${newSkin} skin moisturizer serum treatment`, 4
//               );
//               const prods = ragRes?.results;
//               if (Array.isArray(prods) && prods.length) {
//                 const filtered = prods.filter((p: any) => p.score >= 0.30);
//                 if (filtered.length) {
//                   confirmedProducts =
//                     `PERMITTED PRODUCTS:\n` +
//                     filtered
//                       .map((p: any) =>
//                         `- ${sanitizeForPrompt(p.name)}: ${sanitizeForPrompt(p.description)} | Price: ${p.price} TND`
//                       )
//                       .join("\n");
//                 }
//               }
//             } catch {}

//             const confirmOllama = await axios.post(
//               `${OLLAMA_URL}/api/chat`,
//               {
//                 model: OLLAMA_MODEL,
//                 stream: true,
//                 options: { num_ctx: 2048, num_predict: 200 },
//                 messages: [
//                   {
//                     role: "system",
//                     content:
//                       `You are Lumina, a beauty advisor. ` +
//                       `Respond in ${langLabel}. ` +
//                       `The user has ${newSkin} skin. ` +
//                       `Recommend ONE product from PERMITTED PRODUCTS for ${newSkin} skin. ` +
//                       `Start directly with the product name. ` +
//                       `1-2 sentences max. No greeting. No filler. No question. No mention of profile update.\n\n` +
//                       confirmedProducts,
//                   },
//                   {
//                     role: "user",
//                     content: `Recommend a product for my ${newSkin} skin.`,
//                   },
//                 ],
//               },
//               { responseType: "stream", timeout: STREAM_TIMEOUT_MS }
//             );

//             let confirmReply = "";
//             await new Promise<void>((resolve, reject) => {
//               const timer = setTimeout(
//                 () => reject(new Error("timeout")),
//                 STREAM_TIMEOUT_MS
//               );
//               confirmOllama.data.on("data", (chunk: Buffer) => {
//                 if (clientGone) return;
//                 for (const line of chunk.toString().split("\n").filter(Boolean)) {
//                   try {
//                     const p = JSON.parse(line);
//                     const token = p?.message?.content ?? "";
//                     if (token) { confirmReply += token; sseChunk({ token }); }
//                     if (p.done) { clearTimeout(timer); resolve(); }
//                   } catch {}
//                 }
//               });
//               confirmOllama.data.on("end", () => { clearTimeout(timer); resolve(); });
//               confirmOllama.data.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
//             });

//             if (confirmReply && !clientGone) {
//               const [inserted] = await db
//                 .insert(conversationLogs)
//                 .values({
//                   sessionId: sender,
//                   userId,
//                   userMessage: message,
//                   botMessages: [{ text: confirmReply, confidence: 0.9 }],
//                   intent: "skincare",
//                 })
//                 .returning({ id: conversationLogs.id });
//               sseChunk({ done: true, logId: inserted?.id ?? randomUUID() });
//             }

//             res.end();
//             return res;

//           } else if (intent === "deny") {
//             await resolvePendingConfirmation(userId, false);

//             // Mirror the confirm path: dedicated RAG + Ollama call + early return.
//             // The deny message itself contains no product request so falling through
//             // to the general flow always produces a greeting, not a recommendation.
//             const denyHairType = (pending as any).newHairType ?? null;
//             const denySkinType = pending.newValue ?? null;
//             const isDenyHair   = !!denyHairType;
//             const denyTarget   = isDenyHair ? `${denyHairType} hair` : `${denySkinType} skin`;

//             const denyRagQuery = isDenyHair
//               ? `${denyHairType} hair shampoo conditioner soin capillaire treatment`
//               : `${denySkinType} skin face serum moisturizer treatment`;

//             let denyProductCtx = "";
//             try {
//               const denyRag = await ragClient.search(denyRagQuery, 4);
//               const denyProds = denyRag?.results;
//               if (Array.isArray(denyProds) && denyProds.length) {
//                 const filtered = denyProds.filter((p: any) => p.score >= 0.30);
//                 if (filtered.length) {
//                   denyProductCtx =
//                     `PERMITTED PRODUCTS:\n` +
//                     filtered.map((p: any) =>
//                       `- ${sanitizeForPrompt(p.name)}: ${sanitizeForPrompt(p.description)} | Price: ${p.price} TND`
//                     ).join("\n");
//                 }
//               }
//             } catch {}

//             const denyOllamaCall = await axios.post(
//               `${OLLAMA_URL}/api/chat`,
//               {
//                 model: OLLAMA_MODEL,
//                 stream: true,
//                 options: { num_ctx: 2048, num_predict: 200 },
//                 messages: [
//                   {
//                     role: "system",
//                     content:
//                       `You are Lumina, a beauty advisor. Respond in ${langLabel}. ` +
//                       `The user is asking on behalf of someone else who has ${denyTarget}. ` +
//                       `Recommend ONE product from PERMITTED PRODUCTS suited for ${denyTarget}. ` +
//                       `Do NOT update any profile. Start directly with the product name. ` +
//                       `1-2 sentences max. No greeting. No filler. No question.\n\n` +
//                       denyProductCtx,
//                   },
//                   { role: "user", content: `Recommend a product for ${denyTarget}.` },
//                 ],
//               },
//               { responseType: "stream", timeout: STREAM_TIMEOUT_MS }
//             );

//             let denyReply = "";
//             await new Promise<void>((resolve, reject) => {
//               const timer = setTimeout(() => reject(new Error("timeout")), STREAM_TIMEOUT_MS);
//               denyOllamaCall.data.on("data", (chunk: Buffer) => {
//                 if (clientGone) return;
//                 for (const line of chunk.toString().split("\n").filter(Boolean)) {
//                   try {
//                     const p = JSON.parse(line);
//                     const token = p?.message?.content ?? "";
//                     if (token) { denyReply += token; sseChunk({ token }); }
//                     if (p.done) { clearTimeout(timer); resolve(); }
//                   } catch {}
//                 }
//               });
//               denyOllamaCall.data.on("end",   () => { clearTimeout(timer); resolve(); });
//               denyOllamaCall.data.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
//             });

//             if (denyReply && !clientGone) {
//               const [inserted] = await db
//                 .insert(conversationLogs)
//                 .values({
//                   sessionId: sender,
//                   userId,
//                   userMessage: message,
//                   botMessages: [{ text: denyReply, confidence: 0.85 }],
//                   intent: "skincare",
//                 })
//                 .returning({ id: conversationLogs.id });
//               sseChunk({ done: true, logId: inserted?.id ?? randomUUID() });
//             }

//             res.end();
//             return res;

//           } else {
//             pendingConfirmationCtx =
//               `[SYSTEM NOTE: You previously asked if the user's ${pending.field} changed to "${pending.newValue}". ` +
//               `Their answer was unclear. Gently re-ask in one sentence before continuing.]`;
//           }
//         }
//       }
//       const histCondition = userId
//         ? eq(conversationLogs.userId, userId)
//         : eq(conversationLogs.sessionId, sender);

//       const rawHistory = await db
//         .select()
//         .from(conversationLogs)
//         .where(histCondition)
//         .orderBy(desc(conversationLogs.createdAt))
//         .limit(HISTORY_LIMIT);

//       rawHistory.reverse();

//       const historyMessages: Array<{ role: string; content: string }> = [];

//       for (const turn of rawHistory) {
//         const botText = (turn.botMessages as any[])?.[0]?.text;

//         if (turn.userMessage) {
//           historyMessages.push({
//             role: "user",
//             content: turn.userMessage,
//           });
//         }

//         if (botText) {
//           historyMessages.push({
//             role: "assistant",
//             content: botText,
//           });
//         }
//       }

//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       // Load user profile
//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

//       let dbSkinType: string | null = null;
//       let dbConcern: string | null = null;
//       let dbHairType: string | null = null;

//       if (userId) {
//         try {
//           const tbl =
//             (authSchema as any).users ||
//             (authSchema as any).user;

//           if (tbl) {
//             const u = (
//               await db
//                 .select()
//                 .from(tbl)
//                 .where(eq(tbl.id, userId))
//                 .limit(1)
//             )[0] as any;

//             dbSkinType = u?.skinType ?? u?.skin_type ?? null;
//             dbHairType = u?.hairType ?? u?.hair_type ?? null;
//             dbConcern  = u?.skinConcerns ?? u?.skin_concerns ?? null;
//           }
//         } catch {}
//       }

//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       // Session/profile context
//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

//       const skinCacheKey = `skin:${userId ?? sender}`;

//       const sessionSkinRaw = await redis.get(skinCacheKey);

//       const sessionSkin = sessionSkinRaw
//         ? JSON.parse(sessionSkinRaw)
//         : {
//             type: undefined,
//             hair: undefined,
//             concerns: [],
//           };

//       const effectiveSkin = sessionSkin.type ?? dbSkinType;
//       const effectiveHair = sessionSkin.hair ?? dbHairType;

//       const effectiveConcerns = [
//         ...new Set([
//           ...(sessionSkin.concerns ?? []),
//           ...(dbConcern ? dbConcern.split(",") : []),
//         ]),
//       ].slice(0, 5);

//       await redis.setex(
//       `skin:${userId}`,
//       SKIN_CACHE_TTL,
//       JSON.stringify({ type: effectiveSkin, hair: effectiveHair, concerns: effectiveConcerns })
//       );
//       let profileContext = "";

//       if (effectiveSkin) {
//         profileContext += `User skin type: ${effectiveSkin}. `;
//       }

//       // Regex is source of truth for extraction � fast, French-aware, deterministic
//       const regexExtracted = extractMessageProfile(message);
//       // ollamaAnalyze supplements for intent/language only
//       const analysis = await ollamaAnalyze(sanitizeUserMessage(message));
//       // Regex wins on skin/hair/concerns � AI fills gaps regex cannot cover
//       const extracted = {
//         ...analysis,
//         skinType:      regexExtracted.skinType     ?? analysis.skinType     ?? null,
//         hairType:      regexExtracted.hairType     ?? analysis.hairType     ?? null,
//         skinConcerns:  regexExtracted.skinConcerns.length ? regexExtracted.skinConcerns : analysis.skinConcerns,
//         clearConcerns: regexExtracted.clearConcerns || analysis.clearConcerns,
//       };
//       Object.assign(analysis, extracted);

//       const profileSkinNormalized = (effectiveSkin ?? "").toLowerCase();
//       const profileHairNormalized = (effectiveHair ?? "").toLowerCase();

//       // Session-level last explicit mention (tracks within-session changes)
//       const lastMentionedSkin = (sessionSkin.lastType ?? "").toLowerCase();
//       const lastMentionedHair = (sessionSkin.lastHair ?? "").toLowerCase();

//       // Reference = last explicit mention in session, fallback to DB profile
//       const referenceSkin = lastMentionedSkin || profileSkinNormalized;
//       const referenceHair = lastMentionedHair || profileHairNormalized;

//       console.log("[MISMATCH DEBUG]", { extracted, referenceSkin, referenceHair, lastMentionedSkin, lastMentionedHair });

//       // Mismatch fires when user explicitly mentions a DIFFERENT type than reference
//       const skinMismatch = !!(extracted.skinType && referenceSkin && extracted.skinType !== referenceSkin);
//       const hairMismatch = !!(extracted.hairType && referenceHair && extracted.hairType !== referenceHair);
//       const hasMismatch   = (skinMismatch || hairMismatch) && userId;
//       const messageMentionsDifferentSkin = !!skinMismatch; // keep for compat

//       if (hasMismatch && !(await getPendingConfirmation(userId!))) {
//         const changedFields: string[] = [];
//         if (skinMismatch) changedFields.push(`skin type to ${extracted.skinType}`);
//         if (hairMismatch) changedFields.push(`hair type to ${extracted.hairType}`);
//         if (extracted.skinConcerns.length) changedFields.push(`concerns: ${extracted.skinConcerns.join(", ")}`);

//         const msgLang = detectedLang;
//         const changesSummary = changedFields.join(", ");
//         const concernsSuffix = effectiveConcerns.length ? ` with ${effectiveConcerns.join(", ")}` : "";
//         const concernsSuffixFr = effectiveConcerns.length ? ` avec ${effectiveConcerns.join(", ")}` : "";
//         const concernsSuffixAr = effectiveConcerns.length ? ` ?? ${effectiveConcerns.join("? ")}` : "";

//         const confirmMsg = msgLang === "French"
//           ? `Juste pour confirmer � c'est pour vous ? Votre profil indique une peau ${effectiveSkin ?? "inconnue"}${concernsSuffixFr}. ` +
//             `Souhaitez-vous mettre � jour votre profil (${changesSummary}), ou c'est pour quelqu'un d'autre ?`
//           : msgLang === "Arabic"
//           ? `??????? ??? � ?? ??? ?? ???? ???? ?????? ????? ???? ${effectiveSkin ?? "??? ?????"}${concernsSuffixAr}. ` +
//             `?? ???? ????? ???? ?????? (${changesSummary})? ?? ?? ??? ???? ????`
//           : `Just to confirm � is this for you? Your profile shows ${effectiveSkin ?? "unknown"} skin${concernsSuffix}. ` +
//             `Would you like me to update your profile (${changesSummary}), or is this for someone else?`;

//         await setPendingConfirmation(userId!, {
//           field: "skinType",
//           oldValue: effectiveSkin ?? "",
//           newValue: extracted.skinType ?? effectiveSkin ?? "",
//           newHairType: extracted.hairType ?? undefined,
//           newConcerns: extracted.skinConcerns,
//           clearConcerns: extracted.clearConcerns,
//         });

//         sseChunk({ token: confirmMsg });
//         sseChunk({ done: true, logId: randomUUID() });
//         res.end();
//         return res;
//       }

//       // Reset context if generic request ? kills history contamination from previous "for brother/friend" turns
//       const isGenericRequest = !messageMentionsDifferentSkin && !pendingConfirmationCtx;
//       const contextResetInstruction = (isGenericRequest && effectiveSkin)
//         ? `CONTEXT RESET (critical): The user is now asking about THEMSELVES. ` +
//           `Completely ignore any previous conversation turns mentioning a brother, friend, mother, or anyone else. ` +
//           `The current request is strictly for the user whose saved profile is: ` +
//           `skin type="${effectiveSkin}", concerns="${effectiveConcerns.join(", ") || "none"}". ` +
//           `Recommend based on this profile only.`
//         : "";

//       let profileMismatchInstruction = "";

//       if (effectiveSkin && userId && messageMentionsDifferentSkin) {
//         profileMismatchInstruction =
//           `PROFILE MISMATCH RULE (critical): ` +
//           `The user's saved profile is: skin type="${effectiveSkin}", concerns="${effectiveConcerns.join(", ") || "none"}". ` +
//           `RULE 1 -- If the user asks for a recommendation WITHOUT specifying any skin type or concern ` +
//           `(e.g. "recommend me something", "what should I use"), ` +
//           `use their saved profile DIRECTLY. Do NOT ask any confirmation question. ` +
//           `RULE 2 -- ONLY ask a confirmation question if the user EXPLICITLY mentions a skin type or concern ` +
//           `that is DIFFERENT from their saved profile ` +
//           `(e.g. their profile is oily but they say "for dry skin" or "pour peau sche" or "?????? ??????"). ` +
//           `In that case ONLY, ask ONE question before recommending: ` +
//           `"Just to confirm ? is this for you? Your profile shows ${effectiveSkin} skin` +
//           `${effectiveConcerns.length ? ` with ${effectiveConcerns.join(", ")}` : ""}. ` +
//           `Would you like me to update your profile, or is this for someone else?" ` +
//           `Do NOT give a product name until you have their answer. ` +
//           `A generic request with no skin type mentioned is NEVER a mismatch. Never trigger RULE 2 for those.`;
//       }

//       if (effectiveHair) {
//         profileContext += `Hair type: ${effectiveHair}. `;
//       }

//       const displayConcerns = effectiveConcerns.length ? effectiveConcerns : (extracted.skinConcerns ?? []);
//       if (displayConcerns.length) {
//         profileContext +=
//           `Skin concerns: ${displayConcerns.join(", ")}.`;
//       }

      

//       let orderContext = "";

//       // Extract order code by format only (ORD-XXXXX) � no language keywords needed

//       const orderCodeMatch = message.match(/\b(ORD-[A-Z0-9][\w-]*)/i);
//       const extractedOrderId = orderCodeMatch?.[1]?.toUpperCase() ?? null;

//             const orderQueryDetected = extractedOrderId !== null || analysis.isOrderQuery;

//         if (orderQueryDetected) {
//         // -- Branch 1: not authenticated ----------------------------------
//         if (!userId) {
//           orderContext =
//             "\n[SYSTEM: User is NOT logged in and asked about an order. " +
//             "Tell them to log in first to view their orders. " +
//             `Respond entirely in ${langLabel}. Do not attempt any lookup.]`;
 
//         // -- Branch 2: specific order code supplied ------------------------
//         } else if (extractedOrderId) {
//           try {
//             const orderTable =
//               (orderSchema as any).orders ?? (orderSchema as any).order;
//             const historyTable =
//               (orderHistorySchema as any).orderStatusHistory ??
//               (orderHistorySchema as any).order_status_history ?? null;
 
//             if (orderTable) {
//               const rows = await db
//                 .select()
//                 .from(orderTable)
//                 .where(
//                   and(
//                     eq(orderTable.id, extractedOrderId),
//                     eq(orderTable.userId, userId)
//                   )
//                 )
//                 .limit(1);
 
//               const row = rows[0] as any;
 
//               if (!row) {
//                 orderContext =
//                   `\n[SYSTEM: Order '${sanitizeForPrompt(extractedOrderId)}' was not found ` +
//                   `on this user's account. Never reveal whether it belongs to another user. ` +
//                   `Tell the user this code was not found on their account. Respond entirely in ${langLabel}.]`;
//               } else {
//                 // Build items summary from jsonb array
//                 const items: any[] = Array.isArray(row.items) ? row.items : [];
//                 const itemsSummary = items.length
//                   ? items
//                       .map(
//                         (i: any) =>
//                           `${i.quantity ?? 1}� ${
//                             i.productName ?? i.name ?? i.productId ?? "item"
//                           }`
//                       )
//                       .join(", ")
//                   : "details unavailable";
 
//                 const orderDate = row.createdAt
//                   ? new Date(row.createdAt).toLocaleDateString("en-GB")
//                   : "unknown";
 
//                 const eta = row.estimatedDeliveryDate
//                   ? new Date(row.estimatedDeliveryDate).toLocaleDateString("en-GB")
//                   : "not set";
 
//                 orderContext =
//                   `\nOrder found:` +
//                   `\n- ID: ${row.id}` +
//                   `\n- Status: ${row.status}` +
//                   `\n- Items: ${sanitizeForPrompt(itemsSummary)}` +
//                   `\n- Total: ${row.totalAmount ?? row.total_amount} TND` +
//                   `\n- Payment method: ${row.paymentMethod ?? row.payment_method ?? "N/A"}` +
//                   `\n- Ordered on: ${orderDate}` +
//                   `\n- Tracking number: ${row.trackingNumber ?? row.tracking_number ?? "not assigned yet"}` +
//                   `\n- Estimated delivery: ${eta}`;
 
//                 // Append status history if available
//                 if (historyTable) {
//                   try {
//                     const history = (await db
//                       .select()
//                       .from(historyTable)
//                       .where(eq(historyTable.orderId, extractedOrderId))
//                       .orderBy(desc(historyTable.createdAt))
//                       .limit(5)) as any[];
 
//                     if (history.length) {
//                       const trail = history
//                         .reverse()
//                         .map((h: any) => {
//                           const when = h.createdAt
//                             ? new Date(h.createdAt).toLocaleDateString("en-GB")
//                             : "?";
//                           const from = h.fromStatus ?? "new";
//                           const to = h.toStatus ?? "?";
//                           const note = h.comment ? ` � ${sanitizeForPrompt(h.comment)}` : "";
//                           const tracking = h.trackingNumber
//                             ? ` (tracking: ${h.trackingNumber})`
//                             : "";
//                           return `  ${when}: ${from} ? ${to}${note}${tracking}`;
//                         })
//                         .join("\n");
 
//                       orderContext += `\nStatus history:\n${trail}`;
//                     }
//                   } catch {
//                     // history is optional � silently skip
//                   }
//                 }
//               }
//             }
//           } catch {
//             orderContext =
//               `\n[SYSTEM: Respond entirely in ${langLabel}. Order lookup failed. Tell the user to contact support.]`;
//           }
 
//         // -- Branch 3: order query but no code � list recent orders --------
//         } else {
//           try {
//             const orderTable =
//               (orderSchema as any).orders ?? (orderSchema as any).order;
 
//             if (orderTable) {
//               const recent = (await db
//                 .select()
//                 .from(orderTable)
//                 .where(eq(orderTable.userId, userId))
//                 .orderBy(desc(orderTable.createdAt))
//                 .limit(3)) as any[];
 
//               if (!recent.length) {
//                 orderContext =
//                   `\n[SYSTEM: Respond entirely in ${langLabel}. This user has no orders yet. Tell them so and offer to help with something else.]`;
//               } else {
//                 const list = recent
//                   .map((o: any) => {
//                     const date = o.createdAt
//                       ? new Date(o.createdAt).toLocaleDateString("en-GB")
//                       : "?";
//                     const eta = o.estimatedDeliveryDate
//                       ? `, ETA ${new Date(o.estimatedDeliveryDate).toLocaleDateString("en-GB")}`
//                       : "";
//                     const tracking = o.trackingNumber
//                       ? `, tracking: ${o.trackingNumber}`
//                       : "";
//                     return `- ${o.id}: ${o.status}, ${o.totalAmount ?? o.total_amount} TND, placed ${date}${eta}${tracking}`;
//                   })
//                   .join("\n");
 
//                 orderContext =
//                   `\n[SYSTEM: Respond entirely in ${langLabel}. User asked about their orders without specifying an ID. ` +
//                   `Show them their recent orders listed below. ` +
//                   `If they want details on a specific one, they can ask with the order ID.]\n` +
//                   `Recent orders (most recent first):\n${list}`;
//               }
//             }
//           } catch {
//             orderContext =
//               `\n[SYSTEM: Respond entirely in ${langLabel}. Order lookup failed. Tell the user to contact support.]`;
//           }
//         }
//       }
//       let productContext = "";
//       let hadRagResults = false;
//       let ragTopScore = 0;

//       try {
//         const skinHint = [
//           effectiveSkin,
//           effectiveHair,
//           ...effectiveConcerns.slice(0, 2),
//         ]
//           .filter(Boolean)
//           .join(" ");

//         // Replace the ragQuery block with this:
//         const messageConcerns = extracted.skinConcerns ?? [];
//         const allConcernsForRag = [...new Set([...effectiveConcerns, ...messageConcerns])].slice(0, 3);
//         const isHairQuery = /\b(hair|cheveux|capillaire|shampoo|shampooing|conditioner|apr.s.shampoing|soin cheveux)\b/i.test(message);
//         const ragQuery = ragOverrideSkin
//           ? `${ragOverrideSkin} skin face serum moisturizer treatment`
//           : isHairQuery
//             ? [effectiveHair, "hair shampoo conditioner soin capillaire treatment"].filter(Boolean).join(" ")
//             : (effectiveSkin || allConcernsForRag.length)
//             ? [
//                 effectiveSkin,
//                 ...allConcernsForRag.slice(0, 2),
//                 "skin face product serum moisturizer treatment"
//               ].filter(Boolean).join(" ")
//             : message.slice(0, 300); // fallback: no profile, send message

//         const ragRes = await ragClient.search(ragQuery, 6);

//         const products = ragRes?.results;

//         if (Array.isArray(products) && products.length) {
//           ragTopScore = (products[0] as any)?.score ?? 0;

//           hadRagResults = ragTopScore >= 0.30;

//           if (hadRagResults) {
//             productContext =
//               `\nPERMITTED PRODUCTS (only recommend if user asks):\n` +
//               products
//                 .filter((p: any) => p.score >= 0.30)
//                 .map((p: any) =>
//                   `- ${sanitizeForPrompt(p.name)}: ` +
//                   `${sanitizeForPrompt(p.description)}` +
//                   ` | Price: ${p.price} TND` +
//                   (p.rating
//                     ? ` | Rating: ${p.rating}/5`
//                     : "")
//                 )
//                 .join("\n");
//           }

//           if (userId) {
//             const uc = new TrackSignalUseCase();

//             setImmediate(async () => {
//               for (const p of (products as any[]).slice(0, 3)) {
//                 if (p.id) {
//                   await uc.execute({
//                     userId,
//                     type: "chat_rag",
//                     productId: p.id,
//                   }).catch(() => {});
//                 }
//               }
//             });
//           }
//         }
//       } catch {
//         console.log("[CHAT] RAG unavailable");
//       }

//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       // System prompt
//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       const langInstruction = detectedLang === "auto"
//         ? "LANGUAGE RULE: Detect the language of THIS SPECIFIC message and respond ENTIRELY in that language. Ignore the language of previous messages in history. If THIS message is French, respond in French. If English, respond in English. If Arabic, respond in Arabic. The current message language always overrides history."
//         : `LANGUAGE RULE: The user is writing in ${detectedLang}. You MUST respond entirely in ${detectedLang}. Do not switch languages.`;

//       const systemPrompt = [
//         BASE_SYSTEM_PROMPT,
//         langInstruction,
//         profileContext,
//         contextResetInstruction,
//         profileMismatchInstruction,
//         pendingConfirmationCtx,
//         orderContext,
//         productContext,
//         langInstruction,
//         `FINAL OVERRIDE: Your entire response must be in ${langLabel}. This includes order summaries, product names, and all field labels.`,
//       ]
//         .filter(Boolean)
//         .join("\n");

//       const ollamaMessages = [
//         {
//           role: "system",
//           content: systemPrompt,
//         },
//         ...historyMessages,
//         {
//           role: "user",
//           content: `[LANGUAGE: Respond in ${detectedLang} only. Every word must be ${detectedLang}.] ${sanitizeUserMessage(message)}`,
//         },
//       ];

    

//       console.log("[CHAT] Calling Ollama");

//       const ollamaRes = await axios.post(
//         `${OLLAMA_URL}/api/chat`,
//         {
//           model: OLLAMA_MODEL,
//           messages: ollamaMessages,
//           stream: true,
//           options: {
//             num_ctx: 2048,
//             num_predict: 400,
//           },
//         },
//         {
//           responseType: "stream",
//           timeout: STREAM_TIMEOUT_MS,
//         }
//       );

//       let fullReply = "";

//       await new Promise<void>((resolve, reject) => {
//         const timer = setTimeout(
//           () => reject(new Error("Ollama stream timed out")),
//           STREAM_TIMEOUT_MS
//         );

//         ollamaRes.data.on("data", (chunk: Buffer) => {
//           if (clientGone) {
//             try {
//               ollamaRes.data.destroy();
//             } catch {}

//             return;
//           }

//           for (const line of chunk.toString().split("\n").filter(Boolean)) {
//             try {
//               const p = JSON.parse(line);

//               const token = p?.message?.content ?? "";

//               if (token) {
//                 fullReply += token;
//                 sseChunk({ token });
//               }

//               if (p.done) {
//                 clearTimeout(timer);
//                 resolve();
//               }
//             } catch {}
//           }
//         });

//         ollamaRes.data.on("end", () => {
//           clearTimeout(timer);
//           resolve();
//         });

//         ollamaRes.data.on("error", (e: Error) => {
//           clearTimeout(timer);
//           reject(e);
//         });
//       });

//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       // Persist conversation
//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

//       let logId: string | null = null;

//       if (fullReply && !clientGone) {
//         const intent =
//           hadRagResults
//             ? "skincare"
//             : analysis.isGreeting
//             ? "greeting"
//             : "general";

//         const confidence = hadRagResults
//           ? Math.min(0.95, 0.5 + ragTopScore * 0.5)
//           : 0.5;

//         const [inserted] = await db
//           .insert(conversationLogs)
//           .values({
//             sessionId: sender,
//             userId,
//             userMessage: message,
//             botMessages: [
//               {
//                 text: fullReply,
//                 confidence,
//               },
//             ],
//             intent,
//           })
//           .returning({
//             id: conversationLogs.id,
//           });

//         logId = inserted?.id ?? null;
//       }

//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//       // Async profile intelligence
//       // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

//       if (userId) {
//         setImmediate(async () => {
//           try {
//             const extracted =
//               await extractProfileFromMessage(message);

//             if (extracted) {
//               await handleProfileUpdate(userId, extracted);
//             }
//           } catch {}
//         });
//       }

//       if (!clientGone) {
//         sseChunk({
//           done: true,
//           logId: logId ?? randomUUID(),
//         });
//       }

//       res.end();

//     } catch (err: any) {
//       console.log("[CHAT] ERROR:", err.message);

//       if (!clientGone) {
//         sseChunk({
//           error: "Beauty advisor is temporarily unavailable.",
//         });
//       }

//       res.end();
//     }

//     return res;
//   }
// }

import { JsonController, Post, Body, Res, CurrentUser, UseBefore } from "routing-controllers";
import { promptInjectionGuard } from "../middlewares/promptInjectionGuard.js";
import { Response } from "express";
import { Service, Inject } from "typedi";
import axios from "axios";
import { ragClient } from "../../infrastructure/services/RagHttpsClient.js";
import { randomUUID } from "crypto";
import { eq, desc, and } from "drizzle-orm";
import { ChatMessageDto } from "../dtos/ChatMessageDto.js";
import { redis } from "../../infrastructure/redis/index.js";
import { db } from "../../infrastructure/db/index.js";
import { conversationLogs } from "../../infrastructure/db/schema/conversationLogs.js";
import * as authSchema from "../../infrastructure/db/schema/auth.js";
import * as orderSchema from "../../infrastructure/db/schema/orders.js";
import * as orderHistorySchema from "../../infrastructure/db/schema/order_status_history.js";
import { IProductRepository } from "../../core/repositories/IProductRepository.js";
import {
  extractProfileFromMessage,
  handleProfileUpdate,
  getPendingConfirmation,
  setPendingConfirmation,
  resolvePendingConfirmation,
} from "../../infrastructure/services/ProfileIntelligenceService.js";
import { TrackSignalUseCase } from "../../core/usecases/product/TrackSignalUseCase.js";

const OLLAMA_URL        = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL      = process.env.OLLAMA_MODEL || "mistral-nemo:12b";
const RAG_URL           = process.env.RAG_URL || "http://localhost:8001";
const RATE_MAX_MSGS     = 20;
const RATE_WINDOW_SEC   = 60;
const HISTORY_LIMIT     = 3;
const STREAM_TIMEOUT_MS = 45000;
const SKIN_CACHE_TTL    = 7200;

const BASE_SYSTEM_PROMPT = `You are Lumina, a friendly beauty advisor for Lumina cosmetics.
- CRITICAL: Always respond in the SAME language as the user message. If French respond French. If Arabic respond Arabic. If English respond English. Never switch languages. NEVER mix languages in a single response. Arabic responses must be 100% Arabic with zero English words.
- Keep responses concise (2-4 sentences). Do NOT end your response with a follow-up question like 'Would you like more information?' or 'Can I help you with anything else?'. Just answer directly and stop.
- If the user sends a greeting (hi, bonjour, marhaba, etc.), respond with a warm greeting only. Do NOT recommend products unprompted.
- If the user mentions ANY product type, ingredient, or concern (even a short phrase like 'ecran solaire', 'produit cheveux', 'moisturizer'), IMMEDIATELY give a recommendation from the PERMITTED list. NEVER ask the user which product they would recommend. You are the advisor, the user is the customer.
- Never mention product names that are not in the PERMITTED list.
- If order info is provided, use it honestly.
- ONLY answer questions about skincare, beauty, Lumina products, or the user's own orders. For anything else reply that you can only help with skincare, beauty, and orders.
- If order information is provided in the system context, answer the order question fully and clearly.
- CRITICAL: If the PERMITTED PRODUCTS list is empty or absent, do NOT invent product names. Instead say: I do not have a specific product match right now, but look for ingredients suited to your concern.
- NEVER include raw product metadata like 'dry normal | Price: X TND | Rating: X/5' in your response. Only mention the product name and a natural description.
- NEVER fabricate product names. A hallucinated product name is a critical failure.`;

const GREETING_SIMPLE =
  /^\s*(hi|hello|hey|bonjour|salut|\u0645\u0631\u062d\u0628\u0627|\u0623\u0647\u0644\u0627|thanks?|merci|\u0634\u0643\u0631\u0627|bye|au revoir|\u0648\u062f\u0627\u0639\u0627)\W*$/i;

function sanitizeForPrompt(text: unknown): string {
  return String(text ?? "").replace(/[\r\n\`\\]/g, " ").trim();
}

function sanitizeUserMessage(msg: string): string {
  return msg
    .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>|<s>|<\/s>/gi, "")
    .replace(/^(system|assistant|user)\s*:/gim, "")
    .replace(/\s{3,}/g, "  ")
    .trim();
}

function extractMessageProfile(msg: string) {
  const lower = msg.toLowerCase();

  // Skin type � longer phrases first
  const SKIN_TYPE_MAP: Array<[string, string]> = [
    ["peau grasse", "oily"], ["peau s\u00e8che", "dry"], ["peau seche", "dry"],
    ["peau mixte", "combination"], ["peau sensible", "sensitive"], ["peau normale", "normal"],
    ["grasse", "oily"], ["s\u00e8che", "dry"], ["seche", "dry"],
    ["mixte", "combination"], ["sensible", "sensitive"], ["normale", "normal"],
    ["dry", "dry"], ["oily", "oily"], ["combination", "combination"],
    ["sensitive", "sensitive"], ["normal", "normal"],
  ];
  let skinType: string | null = null;
  for (const [term, val] of SKIN_TYPE_MAP) {
    if (lower.includes(term)) { skinType = val; break; }
  }

  // Hair type � French longer phrases first, then English
  const HAIR_FR_MAP: Array<[string, string]> = [
    ["cheveux gras", "oily"],    ["cheveux sec", "dry"],     ["cheveux secs", "dry"],
    ["cheveux seche", "dry"],    ["cheveux boucl\u00e9", "curly"], ["cheveux boucle", "curly"],
    ["cheveux fris\u00e9", "curly"], ["cheveux frises", "curly"], ["cheveux epais", "thick"],
    ["\u00e9pais", "thick"],     ["cheveux fins", "fine"],   ["cheveux fin", "fine"],
    ["cheveux ondul\u00e9", "wavy"], ["cheveux lisse", "straight"], ["cheveux raide", "straight"],
    ["cheveux normal", "normal"],
  ];
  let hairType: string | null = null;
  for (const [term, val] of HAIR_FR_MAP) {
    if (lower.includes(term)) { hairType = val; break; }
  }
  if (!hairType) {
    const hairMatch =
      lower.match(/\b(dry|oily|normal|curly|fine|thick|straight|wavy)\s+hair\b/) ||
      lower.match(/\bhair\s+(?:is\s+)?(dry|oily|normal|curly|fine|thick|straight|wavy)\b/) ||
      lower.match(/\b(curly|wavy|straight|fine|thick)\b/);
    hairType = hairMatch ? (hairMatch[1] ?? hairMatch[2] ?? null) : null;
  }

  // Concerns
  const CONCERNS = [
    "redness", "acne", "aging", "dullness", "pores", "wrinkles",
    "sensitivity", "dehydration", "hyperpigmentation", "dark spots", "dark circles",
    "rougeur", "rides", "taches", "boutons", "sensibilite", "deshydratation",
  ];
  const skinConcerns = CONCERNS.filter(k => lower.includes(k));
  const clearConcerns = /no\s+(skin\s+)?concern|sans\s+(souci|concern|probl\u00e8me)|aucune\s+pr\u00e9occupation|pas\s+de\s+(souci|probl\u00e8me)/i.test(msg);

  return { skinType, hairType, skinConcerns, clearConcerns };
}

// Scoring-based � immune to shared beauty vocabulary (type, serum, masque, etc.)
function detectLanguage(msg: string): "French" | "Arabic" | "English" {
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(msg)) return "Arabic";

  const lower = msg.toLowerCase();
  const words = lower.match(/\b[a-z\u00c0-\u024f]+\b/g) ?? [];

  // Unambiguous French-only tokens
  const FR = new Set([
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
    "une", "des", "du", "et", "est", "pour", "avec", "sur", "dans",
    "que", "qui", "mon", "ma", "mes", "son", "sa", "ses",
    "ce", "cette", "au", "aux", "ne", "pas", "tr\u00e8s", "tres",
    "aussi", "comme", "mais", "donc", "bonjour", "salut", "merci",
    "oui", "non", "voici", "cheveux", "peau", "produit", "teint",
    "recommande", "recommandez", "recommander", "conseille", "conseillez",
    "livraison", "m\u00eame", "meme", "soins", "cr\u00e8me", "creme",
    "veux", "besoin", "aide", "soin", "capillaire", "moi", "votre",
    "juste", "indique", "souhaitez", "mettre", "\u00e0",
  ]);

  // Unambiguous English-only tokens
  const EN = new Set([
    "i", "me", "my", "you", "your", "we", "our", "they", "their",
    "the", "a", "an", "is", "are", "was", "were", "have", "has", "had",
    "for", "with", "what", "how", "when", "where", "which", "that",
    "recommend", "recommand", "suggest", "help", "need", "want",
    "give", "tell", "show", "find", "get", "use", "do", "does", "can",
    "should", "would", "will", "just", "please", "thanks", "thank",
    "hello", "hi", "hey", "good", "best", "any", "some", "and", "but",
    "or", "so", "skin", "hair", "type", "care", "product", "products",
  ]);

  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR.has(w)) fr++;
    if (EN.has(w)) en++;
  }

  // Accented characters are a strong French signal
  if (/[\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u00e7]/.test(msg)) fr += 3;

  // Default English � only flip when French clearly wins
  return fr > en ? "French" : "English";
}

async function classifyUserIntent(
  message: string,
  pending: { field: string; oldValue: string; newValue: string }
): Promise<"confirm" | "deny" | "other"> {
  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.0, num_predict: 80, num_ctx: 512 },
        messages: [
          {
            role: "system",
            content: `You are a semantic intent classifier. Output valid JSON only. No markdown, no explanation.`,
          },
          {
            role: "user",
            content:
              `A beauty advisor asked: "Is your ${pending.field} ${pending.newValue}? ` +
              `Your saved profile shows ${pending.oldValue}. Is this for you or someone else?"\n\n` +
              `The user replied: "${message}"\n\n` +
              `- "confirm": user agrees this is for THEMSELVES or wants profile updated\n` +
              `- "deny": user says it is for another person or explicitly rejects\n` +
              `- "other": unrelated\n\n` +
              `Short replies (yes, oui, moi, me, sure, its me) almost always mean confirm.\n` +
              `Respond with JSON exactly: {"intent":"confirm","reason":"one sentence"}`,
          },
        ],
      },
      { timeout: 6000 }
    );
    const raw = (res.data?.message?.content ?? "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    const intent = (parsed?.intent ?? "").toLowerCase();
    if (intent === "confirm") return "confirm";
    if (intent === "deny") return "deny";
    return "other";
  } catch {
    const lower = message.toLowerCase();
    const denyRe    = /\b(no|non|nope|not me|pas moi|pour mon|pour ma|friend|ami|frere|brother|sister|someone else|autre|introgger|interroger)\b/;
    const confirmRe = /\b(yes|oui|yep|sure|ok|okay|update|me|moi|correct|right|yea|yeah|exactly)\b|c.?est moi|it.?s me/;
    if (denyRe.test(lower))    return "deny";
    if (confirmRe.test(lower)) return "confirm";
    if (message.trim().split(/\s+/).length <= 4) return "confirm";
    return "other";
  }
}

const ORDER_RE = new RegExp(
  [
    "\\b(order|orders|delivery|delivered|shipping|shipped|tracking|package|parcel|arrived|receipt|purchase|bought|status)\\b",
    "\\b(commande|commandes|livraison|livr\u00e9|exp\u00e9di\u00e9|suivi|colis|statut|achat|arriv\u00e9|re\u00e7u|exp\u00e9dition)\\b",
    "[\u0637\u0644\u0628]|[\u062a\u0633\u0644\u064a\u0645]|[\u0634\u062d\u0646]|[\u062a\u062a\u0628\u0639]|[\u0648\u0635\u0644]",
  ].join("|"),
  "i"
);

function isOrderQuery(message: string): boolean {
  return ORDER_RE.test(message);
}

async function ollamaAnalyze(message: string): Promise<{
  language: "French" | "Arabic" | "English";
  isGreeting: boolean;
  isOrderQuery: boolean;
  skinType: string | null;
  hairType: string | null;
  skinConcerns: string[];
  clearConcerns: boolean;
}> {
  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.0, num_predict: 250, num_ctx: 1024 },
        messages: [
          {
            role: "system",
            content: "You are a message analyzer. Output valid JSON only. No markdown, no explanation.",
          },
          {
            role: "user",
            content:
              `Analyze this beauty-app message and return JSON with:\n` +
              `- language: "French", "Arabic", or "English"\n` +
              `- isGreeting: true only if the whole message is a greeting\n` +
              `- isOrderQuery: true if the user asks about order/delivery/shipping/tracking\n` +
              `- skinType: in English � oily(gras/grasse), dry(sec/seche/s\u00e8che), combination(mixte), sensitive(sensible), normal. null if not mentioned.\n` +
              `- hairType: in English � oily(gras), dry(sec/seche/s\u00e8che), curly(boucl\u00e9/fris\u00e9), wavy(ondul\u00e9), straight(lisse), fine(fin), thick(epais/\u00e9pais), normal. null if not mentioned.\n` +
              `- skinConcerns: array from [acne,redness,aging,dark spots,wrinkles,dullness,pores,sensitivity,dehydration,hyperpigmentation] or []\n` +
              `- clearConcerns: true if user explicitly says they have no concerns\n\n` +
              `Message: "${message.replace(/"/g, '\\"').slice(0, 400)}"\n\nJSON only.`,
          },
        ],
      },
      { timeout: 6000 }
    );
    const raw = (res.data?.message?.content ?? "").replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch {
    const ex = extractMessageProfile(message);
    return {
      language: detectLanguage(message),
      isGreeting: GREETING_SIMPLE.test(message),
      isOrderQuery: ORDER_RE.test(message),
      skinType: ex.skinType,
      hairType: ex.hairType,
      skinConcerns: ex.skinConcerns,
      clearConcerns: ex.clearConcerns,
    };
  }
}

// Helper: run a streaming Ollama call and collect the full reply via SSE
async function streamOllama(
  params: { model: string; messages: any[]; options?: any },
  sseChunk: (d: Record<string, unknown>) => void,
  clientGone: () => boolean,
  timeoutMs: number
): Promise<string> {
  const res = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    { stream: true, ...params },
    { responseType: "stream", timeout: timeoutMs }
  );
  let full = "";
  await new Promise<void>((resolve, reject) => {
    let timer = setTimeout(() => reject(new Error("Ollama timeout")), timeoutMs);
    res.data.on("data", (chunk: Buffer) => {
      if (clientGone()) { try { res.data.destroy(); } catch {} return; }
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        try {
          const p = JSON.parse(line);
          const token = p?.message?.content ?? "";
          if (token) { full += token; sseChunk({ token }); clearTimeout(timer); timer = setTimeout(() => reject(new Error("Ollama timeout")), timeoutMs); }
          if (p.done) { clearTimeout(timer); resolve(); }
        } catch {}
      }
    });
    res.data.on("end",   () => { clearTimeout(timer); resolve(); });
    res.data.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
  });
  return full;
}

@JsonController("/chat")
@Service()
export class ChatController {
  @Inject("IProductRepository")
  private productRepository!: IProductRepository;

  @UseBefore(promptInjectionGuard)
  @Post("/message")
  async message(
    @Body() body: ChatMessageDto,
    @CurrentUser() currentUser: any,
    @Res() res: Response
  ) {
    console.log("[CHAT] START | user:", currentUser?.id ?? "anon");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sseChunk = (data: Record<string, unknown>) =>
      res.write(`data: ${JSON.stringify(data)}\n\n`);

    const sender  = body.sessionId || "anon";
    const message = body.message?.trim() || "";

    if (!message) {
      sseChunk({ error: "Message is required." });
      res.end();
      return res;
    }

    // -- Rate limiting ---------------------------------------------------------
    const rateLimitId = currentUser?.id ?? sender;
    const rateKey = `chat_rate:${rateLimitId}`;
    let count = 0;
    try {
      count = await redis.incr(rateKey);
      if (count === 1) await redis.expire(rateKey, RATE_WINDOW_SEC);
    } catch {}
    if (count > RATE_MAX_MSGS) {
      sseChunk({ error: "Too many messages. Please wait a moment." });
      res.end();
      return res;
    }

    let _clientGone = false;
    res.on("close", () => { _clientGone = true; });
    const clientGone = () => _clientGone;

    try {
      const userId = currentUser?.id ?? null;

      // Detect language once � used everywhere
      const detectedLang = detectLanguage(message);

      // Language primer tokens � force small model to start in the right language
      const PRIMERS: Record<string, string> = {
        French:  "Bien s\u00fbr\u00a0! ",
        Arabic:  "\u0628\u0627\u0644\u0637\u0628\u0639! ",
        English: "",
      };
      const primer = PRIMERS[detectedLang] ?? "";

      // -- Pending confirmation ----------------------------------------------
      if (userId) {
        const pending = await getPendingConfirmation(userId);

        if (pending) {
          const intent = await classifyUserIntent(message, pending);

          // -- CONFIRM: user says "yes, it's for me" -----------------------
          if (intent === "confirm") {
            await resolvePendingConfirmation(userId, true);

            try {
              const tbl = (authSchema as any).users || (authSchema as any).user;
              if (tbl) {
                const upd: any = {};
                if (pending.newValue)             upd.skinType     = pending.newValue;
                if ((pending as any).newHairType) upd.hairType     = (pending as any).newHairType;
                if ((pending as any).clearConcerns) {
                  upd.skinConcerns = "";
                } else if ((pending as any).newConcerns?.length) {
                  upd.skinConcerns = (pending as any).newConcerns.join(",");
                }
                if (Object.keys(upd).length) {
                  await db.update(tbl).set(upd).where(eq(tbl.id, userId));
                }
              }
            } catch {}
            await redis.del(`skin:${userId}`);

            const isHairConfirm = pending.field === "hairType";
            const confirmTarget = isHairConfirm
              ? `${(pending as any).newHairType} hair`
              : `${pending.newValue} skin`;
            const confirmRagQ   = isHairConfirm
              ? `${(pending as any).newHairType} hair shampoo conditioner soin capillaire`
              : `${pending.newValue} skin moisturizer serum treatment`;

            let confirmProds = "";
            try {
              const r = await ragClient.search(confirmRagQ, 4);
              const hits = (r?.results ?? []).filter((p: any) => p.score >= 0.30);
              if (hits.length) {
                confirmProds = "PERMITTED PRODUCTS:\n" +
                  hits.map((p: any) => `- ${sanitizeForPrompt(p.name)}: ${sanitizeForPrompt(p.description)} | Price: ${p.price} TND`).join("\n");
              }
            } catch {}

            const confirmReply = await streamOllama({
              model: OLLAMA_MODEL,
              options: { num_ctx: 2048, num_predict: 200 },
              messages: [
                {
                  role: "system",
                  content:
                    `You are Lumina, a beauty advisor. Respond in ${detectedLang}. ` +
                    `The user has ${confirmTarget}. Recommend ONE product from PERMITTED PRODUCTS. ` +
                    `Start directly with the product name. 1-2 sentences max. No greeting. No question.\n\n` +
                    confirmProds,
                },
                { role: "user",      content: `Recommend a product for my ${confirmTarget}.` },
                ...(primer ? [{ role: "assistant", content: primer }] : []),
              ],
            }, sseChunk, clientGone, STREAM_TIMEOUT_MS);

            if (confirmReply && !clientGone()) {
              const [ins] = await db.insert(conversationLogs).values({
                sessionId: sender, userId, userMessage: message,
                botMessages: [{ text: confirmReply, confidence: 0.9 }],
                intent: "skincare",
              }).returning({ id: conversationLogs.id });
              sseChunk({ done: true, logId: ins?.id ?? randomUUID() });
            }
            res.end();
            return res;
          }

          // -- DENY: user says "no, it's for my brother/friend" ------------
          if (intent === "deny") {
            await resolvePendingConfirmation(userId, false);

            const isHairDeny  = pending.field === "hairType";
            const denyTarget  = isHairDeny
              ? `${(pending as any).newHairType} hair`
              : `${pending.newValue} skin`;
            const denyRagQ    = isHairDeny
              ? `${(pending as any).newHairType} hair shampoo conditioner soin capillaire`
              : `${pending.newValue} skin face serum moisturizer treatment`;

            let denyProds = "";
            try {
              const r = await ragClient.search(denyRagQ, 4);
              const hits = (r?.results ?? []).filter((p: any) => p.score >= 0.30);
              if (hits.length) {
                denyProds = "PERMITTED PRODUCTS:\n" +
                  hits.map((p: any) => `- ${sanitizeForPrompt(p.name)}: ${sanitizeForPrompt(p.description)} | Price: ${p.price} TND`).join("\n");
              }
            } catch {}

            const denyReply = await streamOllama({
              model: OLLAMA_MODEL,
              options: { num_ctx: 2048, num_predict: 200 },
              messages: [
                {
                  role: "system",
                  content:
                    `You are Lumina, a beauty advisor. Respond entirely in ${detectedLang}. ` +
                    `The user is asking on behalf of someone else with ${denyTarget}. ` +
                    `Recommend ONE product from PERMITTED PRODUCTS for ${denyTarget}. ` +
                    `Do NOT update any profile. Do NOT mention the user's own profile. ` +
                    `Start directly with the product name. 1-2 sentences max. No greeting. No question.\n\n` +
                    denyProds,
                },
                { role: "user",      content: `Recommend a product for ${denyTarget}.` },
                ...(primer ? [{ role: "assistant", content: primer }] : []),
              ],
            }, sseChunk, clientGone, STREAM_TIMEOUT_MS);

            if (denyReply && !clientGone()) {
              const [ins] = await db.insert(conversationLogs).values({
                sessionId: sender, userId, userMessage: message,
                botMessages: [{ text: denyReply, confidence: 0.85 }],
                intent: "skincare",
              }).returning({ id: conversationLogs.id });
              sseChunk({ done: true, logId: ins?.id ?? randomUUID() });
            }
            res.end();
            return res;
          }

          // -- OTHER: unclear answer � gently re-ask ------------------------
          // fall through with a note injected into the system prompt
        }
      }

      // -- History -----------------------------------------------------------
      const histCond = userId
        ? eq(conversationLogs.userId, userId)
        : eq(conversationLogs.sessionId, sender);

      const rawHistory = await db
        .select().from(conversationLogs).where(histCond)
        .orderBy(desc(conversationLogs.createdAt)).limit(HISTORY_LIMIT);
      rawHistory.reverse();

      const historyMessages: Array<{ role: string; content: string }> = [];
      for (const turn of rawHistory) {
        const botText = (turn.botMessages as any[])?.[0]?.text;
        if (turn.userMessage) historyMessages.push({ role: "user",      content: turn.userMessage });
        if (botText)          historyMessages.push({ role: "assistant", content: botText });
      }

      // -- Profile -----------------------------------------------------------
      let dbSkinType: string | null = null;
      let dbHairType: string | null = null;
      let dbConcern:  string | null = null;

      if (userId) {
        try {
          const tbl = (authSchema as any).users || (authSchema as any).user;
          if (tbl) {
            const u = (await db.select().from(tbl).where(eq(tbl.id, userId)).limit(1))[0] as any;
            dbSkinType = u?.skinType ?? u?.skin_type ?? null;
            dbHairType = u?.hairType ?? u?.hair_type ?? null;
            dbConcern  = u?.skinConcerns ?? u?.skin_concerns ?? null;
          }
        } catch {}
      }

      const skinCacheKey   = `skin:${userId ?? sender}`;
      const sessionSkinRaw = await redis.get(skinCacheKey);
      const sessionSkin    = sessionSkinRaw
        ? JSON.parse(sessionSkinRaw)
        : { type: undefined, hair: undefined, concerns: [], lastType: null, lastHair: null };

      const effectiveSkin     = sessionSkin.type ?? dbSkinType;
      const effectiveHair     = sessionSkin.hair ?? dbHairType;
      const effectiveConcerns = [
        ...new Set([
          ...(sessionSkin.concerns ?? []),
          ...(dbConcern ? dbConcern.split(",").filter(Boolean) : []),
        ]),
      ].slice(0, 5);

      // -- Extraction ---------------------------------------------------------
      // Regex is source of truth (French-aware, deterministic)
      // ollamaAnalyze supplements for isGreeting / isOrderQuery only
      const regexEx  = extractMessageProfile(message);
      const analysis = await ollamaAnalyze(sanitizeUserMessage(message));
      const extracted = {
        ...analysis,
        skinType:      regexEx.skinType     ?? analysis.skinType     ?? null,
        hairType:      regexEx.hairType     ?? analysis.hairType     ?? null,
        skinConcerns:  regexEx.skinConcerns.length ? regexEx.skinConcerns : (analysis.skinConcerns ?? []),
        clearConcerns: regexEx.clearConcerns || analysis.clearConcerns,
      };

      // -- Mismatch detection -------------------------------------------------
      const refSkin = (sessionSkin.lastType ?? "").toLowerCase() || (effectiveSkin ?? "").toLowerCase();
      const refHair = (sessionSkin.lastHair ?? "").toLowerCase() || (effectiveHair ?? "").toLowerCase();

      console.log("[MISMATCH DEBUG]", { extracted, refSkin, refHair });

      const skinMismatch = !!(extracted.skinType && refSkin && extracted.skinType !== refSkin);
      const hairMismatch = !!(extracted.hairType && refHair && extracted.hairType !== refHair);
      const hasMismatch  = (skinMismatch || hairMismatch) && !!userId;

      if (hasMismatch && !(await getPendingConfirmation(userId!))) {
        const changedFields: string[] = [];
        if (skinMismatch) changedFields.push(`skin type to ${extracted.skinType}`);
        if (hairMismatch) changedFields.push(`hair type to ${extracted.hairType}`);
        if (extracted.skinConcerns.length) changedFields.push(`concerns: ${extracted.skinConcerns.join(", ")}`);
        const changesSummary = changedFields.join(", ");

        // Build profile description in the right field (hair or skin)
        const pfx = hairMismatch && !skinMismatch;
        const concernSfx = effectiveConcerns.length;
        const profileDescFr = pfx
          ? `des cheveux ${effectiveHair ?? "inconnus"}${concernSfx ? ` avec ${effectiveConcerns.join(", ")}` : ""}`
          : `une peau ${effectiveSkin ?? "inconnue"}${concernSfx ? ` avec ${effectiveConcerns.join(", ")}` : ""}`;
        const profileDescEn = pfx
          ? `${effectiveHair ?? "unknown"} hair${concernSfx ? ` with ${effectiveConcerns.join(", ")}` : ""}`
          : `${effectiveSkin ?? "unknown"} skin${concernSfx ? ` with ${effectiveConcerns.join(", ")}` : ""}`;
        const profileDescAr = pfx
          ? `\u0634\u0639\u0631 ${effectiveHair ?? "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f"}${concernSfx ? ` \u0645\u0639 ${effectiveConcerns.join("\u060c ")}` : ""}`
          : `\u0628\u0634\u0631\u0629 ${effectiveSkin ?? "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f\u0629"}${concernSfx ? ` \u0645\u0639 ${effectiveConcerns.join("\u060c ")}` : ""}`;

        const confirmMsg = detectedLang === "French"
          ? `Juste pour confirmer \u2014 c\u2019est pour vous\u00a0? Votre profil indique ${profileDescFr}. Souhaitez-vous mettre \u00e0 jour votre profil (${changesSummary}), ou c\u2019est pour quelqu\u2019un d\u2019autre\u00a0?`
          : detectedLang === "Arabic"
          ? `\u0644\u0644\u062a\u0623\u0643\u064a\u062f \u0641\u0642\u0637 \u2014 \u0647\u0644 \u0647\u0630\u0627 \u0644\u0643 \u0623\u0646\u062a\u061f \u0645\u0644\u0641\u0643 \u064a\u064f\u0638\u0647\u0631 ${profileDescAr}. \u0647\u0644 \u062a\u0631\u064a\u062f \u062a\u062d\u062f\u064a\u062b \u0645\u0644\u0641\u0643 (${changesSummary})\u060c \u0623\u0645 \u0623\u0646 \u0647\u0630\u0627 \u0644\u0634\u062e\u0635 \u0622\u062e\u0631\u061f`
          : `Just to confirm \u2014 is this for you? Your profile shows ${profileDescEn}. Would you like me to update your profile (${changesSummary}), or is this for someone else?`;

        await setPendingConfirmation(userId!, {
          field:    skinMismatch ? "skinType" : "hairType",
          oldValue: skinMismatch ? (effectiveSkin ?? "") : (effectiveHair ?? ""),
          newValue: skinMismatch ? (extracted.skinType ?? "") : "",
          newHairType:   extracted.hairType ?? undefined,
          newConcerns:   extracted.skinConcerns,
          clearConcerns: extracted.clearConcerns,
        } as any);

        // Persist last-mentioned types for cross-turn mismatch tracking
        await redis.setex(skinCacheKey, SKIN_CACHE_TTL, JSON.stringify({
          type: effectiveSkin, hair: effectiveHair, concerns: effectiveConcerns,
          lastType: extracted.skinType ?? sessionSkin.lastType ?? null,
          lastHair: extracted.hairType ?? sessionSkin.lastHair ?? null,
        }));

        sseChunk({ token: confirmMsg });
        sseChunk({ done: true, logId: randomUUID() });
        res.end();
        return res;
      }

      // No mismatch � persist extracted types for next turn
      if (extracted.skinType || extracted.hairType || extracted.skinConcerns?.length) {
        await redis.setex(skinCacheKey, SKIN_CACHE_TTL, JSON.stringify({
          type: effectiveSkin, hair: effectiveHair, concerns: effectiveConcerns,
          lastType: extracted.skinType ?? sessionSkin.lastType ?? null,
          lastHair: extracted.hairType ?? sessionSkin.lastHair ?? null,
        }));
      }

      // -- Order context -----------------------------------------------------
      let orderContext = "";
      const orderCodeMatch  = message.match(/\b(ORD-[A-Z0-9][\w-]*)/i);
      const extractedOrderId = orderCodeMatch?.[1]?.toUpperCase() ?? null;
      const orderQueryDetected = extractedOrderId !== null || analysis.isOrderQuery;

      if (orderQueryDetected) {
        if (!userId) {
          orderContext = `\n[SYSTEM: User NOT logged in. Tell them to log in. Respond in ${detectedLang}.]`;
        } else if (extractedOrderId) {
          try {
            const orderTable   = (orderSchema as any).orders   ?? (orderSchema as any).order;
            const historyTable = (orderHistorySchema as any).orderStatusHistory ?? (orderHistorySchema as any).order_status_history ?? null;

            if (orderTable) {
              const rows = await db.select().from(orderTable)
                .where(and(eq(orderTable.id, extractedOrderId), eq(orderTable.userId, userId))).limit(1);
              const row = rows[0] as any;

              if (!row) {
                orderContext = `\n[SYSTEM: Order '${sanitizeForPrompt(extractedOrderId)}' not found on this account. Respond in ${detectedLang}.]`;
              } else {
                const items: any[] = Array.isArray(row.items) ? row.items : [];
                const itemsSummary = items.length
                  ? items.map((i: any) => `${i.quantity ?? 1}\u00d7 ${i.productName ?? i.name ?? i.productId ?? "item"}`).join(", ")
                  : "details unavailable";
                const orderDate = row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-GB") : "unknown";
                const eta       = row.estimatedDeliveryDate ? new Date(row.estimatedDeliveryDate).toLocaleDateString("en-GB") : "not set";

                orderContext =
                  `\nOrder found:\n- ID: ${row.id}\n- Status: ${row.status}` +
                  `\n- Items: ${sanitizeForPrompt(itemsSummary)}\n- Total: ${row.totalAmount ?? row.total_amount} TND` +
                  `\n- Payment: ${row.paymentMethod ?? row.payment_method ?? "N/A"}\n- Ordered: ${orderDate}` +
                  `\n- Tracking: ${row.trackingNumber ?? row.tracking_number ?? "not assigned"}\n- ETA: ${eta}`;

                if (historyTable) {
                  try {
                    const hist = (await db.select().from(historyTable)
                      .where(eq(historyTable.orderId, extractedOrderId))
                      .orderBy(desc(historyTable.createdAt)).limit(5)) as any[];
                    if (hist.length) {
                      const trail = hist.reverse().map((h: any) => {
                        const when = h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-GB") : "?";
                        const note = h.comment ? ` \u2014 ${sanitizeForPrompt(h.comment)}` : "";
                        const trk  = h.trackingNumber ? ` (tracking: ${h.trackingNumber})` : "";
                        return `  ${when}: ${h.fromStatus ?? "new"} \u2192 ${h.toStatus ?? "?"}${note}${trk}`;
                      }).join("\n");
                      orderContext += `\nStatus history:\n${trail}`;
                    }
                  } catch {}
                }
              }
            }
          } catch {
            orderContext = `\n[SYSTEM: Order lookup failed. Tell user to contact support. Respond in ${detectedLang}.]`;
          }
        } else {
          try {
            const orderTable = (orderSchema as any).orders ?? (orderSchema as any).order;
            if (orderTable) {
              const recent = (await db.select().from(orderTable)
                .where(eq(orderTable.userId, userId))
                .orderBy(desc(orderTable.createdAt)).limit(3)) as any[];

              if (!recent.length) {
                orderContext = `\n[SYSTEM: User has no orders yet. Respond in ${detectedLang}.]`;
              } else {
                const list = recent.map((o: any) => {
                  const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "?";
                  const eta  = o.estimatedDeliveryDate ? `, ETA ${new Date(o.estimatedDeliveryDate).toLocaleDateString("en-GB")}` : "";
                  const trk  = o.trackingNumber ? `, tracking: ${o.trackingNumber}` : "";
                  return `- ${o.id}: ${o.status}, ${o.totalAmount ?? o.total_amount} TND, placed ${date}${eta}${trk}`;
                }).join("\n");
                orderContext = `\n[SYSTEM: Show user their recent orders. Respond in ${detectedLang}.]\n${list}`;
              }
            }
          } catch {
            orderContext = `\n[SYSTEM: Order lookup failed. Tell user to contact support. Respond in ${detectedLang}.]`;
          }
        }
      }

      // -- RAG ---------------------------------------------------------------
      let productContext = "";
      let hadRagResults  = false;
      let ragTopScore    = 0;

      try {
        const isHairQuery = /\b(hair|cheveux|capillaire|shampoo|shampooing|conditioner|soin cheveux|apr.s.shampoing)\b/i.test(message);
        const allConcerns = [...new Set([...effectiveConcerns, ...(extracted.skinConcerns ?? [])])].slice(0, 3);

        // For hair queries, use the message's hair type (what they asked about) not profile
        const ragHairType = extracted.hairType ?? effectiveHair;

        const ragQuery = isHairQuery
          ? [ragHairType, "hair shampoo conditioner soin capillaire treatment"].filter(Boolean).join(" ")
          : (effectiveSkin || allConcerns.length)
          ? [effectiveSkin, ...allConcerns.slice(0, 2), "skin face product serum moisturizer"].filter(Boolean).join(" ")
          : message.slice(0, 300);

        const ragRes  = await ragClient.search(ragQuery, 6);
        const products = ragRes?.results;

        if (Array.isArray(products) && products.length) {
          ragTopScore   = (products[0] as any)?.score ?? 0;
          hadRagResults = ragTopScore >= 0.30;

          if (hadRagResults) {
            productContext =
              `\nPERMITTED PRODUCTS (only recommend if user asks):\n` +
              products
                .filter((p: any) => p.score >= 0.30)
                .map((p: any) =>
                  `- ${sanitizeForPrompt(p.name)}: ${sanitizeForPrompt(p.description)} | Price: ${p.price} TND` +
                  (p.rating ? ` | Rating: ${p.rating}/5` : "")
                ).join("\n");
          }

          if (userId) {
            const uc = new TrackSignalUseCase();
            setImmediate(async () => {
              for (const p of (products as any[]).slice(0, 3)) {
                if (p.id) await uc.execute({ userId, type: "chat_rag", productId: p.id }).catch(() => {});
              }
            });
          }
        }
      } catch {
        console.log("[CHAT] RAG unavailable");
      }

      // -- System prompt -----------------------------------------------------
      // (1) Imperative + localized profile block so the model does NOT re-ask
      const displayConcerns = effectiveConcerns.length ? effectiveConcerns : (extracted.skinConcerns ?? []);
      const profileLines: string[] = [];
      if (effectiveSkin || effectiveHair || displayConcerns.length) {
        if (detectedLang === "French") {
          profileLines.push(`PROFIL UTILISATEUR (déjà connu — NE JAMAIS redemander):`);
          if (effectiveSkin)          profileLines.push(`- Type de peau: ${effectiveSkin}`);
          if (effectiveHair)          profileLines.push(`- Type de cheveux: ${effectiveHair}`);
          if (displayConcerns.length) profileLines.push(`- Préoccupations: ${displayConcerns.join(", ")}`);
          profileLines.push(`Utilise ces données directement. Ne demande aucune confirmation.`);
        } else if (detectedLang === "Arabic") {
          profileLines.push(`ملف المستخدم (معروف مسبقا — لا تسأل مرة أخرى أبدا):`);
          if (effectiveSkin)          profileLines.push(`- نوع البشرة: ${effectiveSkin}`);
          if (effectiveHair)          profileLines.push(`- نوع الشعر: ${effectiveHair}`);
          if (displayConcerns.length) profileLines.push(`- المخاوف: ${displayConcerns.join("، ")}`);
          profileLines.push(`استخدم هذه البيانات مباشرة. لا تطلب أي تأكيد.`);
        } else {
          profileLines.push(`USER PROFILE (already known — NEVER ask again):`);
          if (effectiveSkin)          profileLines.push(`- Skin type: ${effectiveSkin}`);
          if (effectiveHair)          profileLines.push(`- Hair type: ${effectiveHair}`);
          if (displayConcerns.length) profileLines.push(`- Concerns: ${displayConcerns.join(", ")}`);
          profileLines.push(`Use this data directly. Do not ask for confirmation.`);
        }
      }
      const profileContext = profileLines.join("\n");

      // (2) Language rule written IN the target language — LLMs follow the
      //     language of the instruction more than the content of it.
      const langRule =
        detectedLang === "French"
          ? `RÈGLE DE LANGUE: Réponds UNIQUEMENT en français. Chaque mot doit être en français. Aucun mot anglais.`
          : detectedLang === "Arabic"
          ? `قاعدة اللغة: أجب فقط بالعربية. كل كلمة يجب أن تكون بالعربية. لا توجد كلمات إنجليزية.`
          : `LANGUAGE RULE: Respond ONLY in English. Every word must be English.`;

      const finalOverride =
        detectedLang === "French"
          ? `RAPPEL FINAL: toute la réponse doit être en français.`
          : detectedLang === "Arabic"
          ? `تذكير أخير: يجب أن تكون الإجابة بالكامل بالعربية.`
          : `FINAL REMINDER: entire response must be in English.`;

      const systemPrompt = [
        BASE_SYSTEM_PROMPT,
        langRule,
        profileContext,
        orderContext,
        productContext,
        finalOverride,
      ].filter(Boolean).join("\n");

      // (3) Put the language reminder AFTER the user message — last tokens
      //     dominate the model's first-token choice.
      const ollamaMessages = [
        { role: "system",    content: systemPrompt },
        ...historyMessages,
        { role: "user",      content: `${sanitizeUserMessage(message)}\n\n[${finalOverride}]` },
        ...(primer ? [{ role: "assistant", content: primer }] : []),
      ];

      console.log("[CHAT] Calling Ollama");

      // (4) Lower temperature + repeat penalty → less language drift
      const fullReply = await streamOllama({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        options: {
          num_ctx: 2048,
          num_predict: 400,
          temperature: 0.4,
          top_p: 0.85,
          repeat_penalty: 1.15,
        },
      }, sseChunk, clientGone, STREAM_TIMEOUT_MS);

      // -- Persist -----------------------------------------------------------
      let logId: string | null = null;
      if (fullReply && !clientGone()) {
        const intent     = hadRagResults ? "skincare" : analysis.isGreeting ? "greeting" : "general";
        const confidence = hadRagResults ? Math.min(0.95, 0.5 + ragTopScore * 0.5) : 0.5;

        const [ins] = await db.insert(conversationLogs).values({
          sessionId: sender, userId, userMessage: message,
          botMessages: [{ text: fullReply, confidence }],
          intent,
        }).returning({ id: conversationLogs.id });
        logId = ins?.id ?? null;
      }

      // -- Async profile intelligence ----------------------------------------
      if (userId) {
        setImmediate(async () => {
          try {
            const ex = await extractProfileFromMessage(message);
            if (ex) await handleProfileUpdate(userId, ex);
          } catch {}
        });
      }

      if (!clientGone()) sseChunk({ done: true, logId: logId ?? randomUUID() });
      res.end();

    } catch (err: any) {
      console.log("[CHAT] ERROR:", err.message);
      if (!_clientGone) sseChunk({ error: "Beauty advisor is temporarily unavailable." });
      res.end();
    }

    return res;
  }
}
