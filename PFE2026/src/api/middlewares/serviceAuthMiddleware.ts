import { Request, Response, NextFunction } from "express";

export function serviceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = (req.headers["authorization"] ?? "") as string;
  const provided   = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const expected   = process.env.RAG_SERVICE_TOKEN ?? "";

  if (!expected) {
    res.status(500).json({ error: "Server misconfiguration: service token not configured." });
    return;
  }
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Invalid or missing service token." });
    return;
  }
  next();
}
