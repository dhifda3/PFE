import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND =
  (process.env.EXPRESS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000").replace(/\/$/, "");

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "host",
  "content-length",
]);

async function handle(req: NextRequest, ctx: { params: { path: string[] } }) {
  const path = (ctx.params.path ?? []).join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND}/api/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(url, init);

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (HOP_BY_HOP.has(k.toLowerCase())) return;
    if (k.toLowerCase() === "set-cookie") return; // handled below
    outHeaders.set(k, v);
  });

  // Forward Set-Cookie headers (may be multiple). Strip Domain so cookie lands on the Vercel host.
  const raw = (upstream.headers as any).getSetCookie?.() as string[] | undefined;
  const cookies = raw ?? upstream.headers.get("set-cookie")?.split(/,(?=[^;]+=)/) ?? [];
  for (const c of cookies) {
    outHeaders.append("set-cookie", c.replace(/;\s*Domain=[^;]+/i, ""));
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export const GET     = handle;
export const POST    = handle;
export const PUT     = handle;
export const PATCH   = handle;
export const DELETE  = handle;
export const OPTIONS = handle;
export const HEAD    = handle;
