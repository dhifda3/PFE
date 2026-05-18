import https from 'https';
import fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
dotenv.config();

function buildRagClient(): AxiosInstance {
  const ragUrl = process.env.RAG_URL ?? 'http://localhost:8001';

  let httpsAgent: https.Agent | undefined;
  const certPath = process.env.MTLS_CLIENT_CERT;
  const keyPath  = process.env.MTLS_CLIENT_KEY;
  const caPath   = process.env.MTLS_CA_CERT;

  if (certPath && keyPath && caPath) {
    try {
      httpsAgent = new https.Agent({
        cert: fs.readFileSync(certPath),
        key:  fs.readFileSync(keyPath),
        ca:   fs.readFileSync(caPath),
        rejectUnauthorized: true,
      });
      console.log('[RagClient] mTLS enabled');
    } catch (err) {
      console.error('[RagClient] Failed to load mTLS certs:', err);
    }
  } else {
    console.warn('[RagClient] mTLS certs not configured. Running without mTLS.');
  }

  const instance = axios.create({
    baseURL: ragUrl,
    timeout: 120_000,
    httpsAgent,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    config.headers['Authorization'] = `Bearer ${process.env.RAG_SERVICE_TOKEN ?? ''}`;
    return config;
  });

  return instance;
}

const client = buildRagClient();

export const ragClient = {
  async sync(): Promise<{ synced: number }> {
    const res = await client.post('/sync');
    return res.data;
  },

  async reindex(): Promise<{ synced: number }> {
    const res = await client.post('/reindex');
    return res.data;
  },

  async search(query: string, limit = 4): Promise<{ results: any[] }> {
    const res = await client.get('/search', { params: { q: query, limit } });
    return res.data;
  },

  async health(): Promise<{ status: string; vectors: number }> {
    const res = await client.get('/health');
    return res.data;
  },

  async classifyInjection(message: string): Promise<{ is_injection: boolean; score: number }> {
    try {
      const res = await client.post('/classify-injection', { message }, { timeout: 5_000 });
      return res.data;
    } catch {
      return { is_injection: false, score: 0 };
    }
  },
};






