import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";          // 30s timeout on Hobby instead of 10s
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const EXPRESS_URL = (process.env.EXPRESS_API_URL || "http://localhost:3000").replace(/\/$/, "");
const MAX_MESSAGE_LENGTH = 500;
const SESSION_ID_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

export async function POST(req: NextRequest) {
  let body: { message?: unknown; sessionId?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.message || typeof body.message !== "string" || !body.message.trim())
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (body.message.length > MAX_MESSAGE_LENGTH)
    return NextResponse.json({ error: "Message too long (max 500 characters)" }, { status: 400 });

  const rawSessionId =
    typeof body.sessionId === "string" && SESSION_ID_RE.test(body.sessionId)
      ? body.sessionId : "anon";

  const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
  const cookie = req.headers.get("cookie");
  if (cookie) forwardHeaders["cookie"] = cookie;
  const authorization = req.headers.get("authorization");
  if (authorization) forwardHeaders["authorization"] = authorization;

  try {
    const upstream = await fetch(`${EXPRESS_URL}/api/chat/message`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify({ message: body.message.trim(), sessionId: rawSessionId }),
    });
    if (!upstream.ok || !upstream.body)
      return NextResponse.json({ error: "Chat service unavailable" }, { status: 503 });
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach chat service" }, { status: 503 });
  }
}