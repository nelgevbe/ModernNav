import { verify } from "./utils/authHelpers";
import { parseMetadata } from "../../src/utils/parseMetadata";

interface Env {
  DB?: D1Database;
}

const BLOCKED_HOSTS = ["localhost", "[::1]"];
const BLOCKED_IP_PREFIXES = ["127.", "10.", "0."];

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTS.includes(hostname)) return true;
  if (BLOCKED_IP_PREFIXES.some((p) => hostname.startsWith(p))) return true;
  if (hostname.startsWith("192.168.")) return true;
  const m172 = hostname.match(/^172\.(\d+)\./);
  if (m172) {
    const second = parseInt(m172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (hostname === "::1" || hostname === "[::1]") return true;
  return false;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token || !env.DB) return jsonError("Unauthorized", 401);

    const codeRow = await env.DB.prepare("SELECT value FROM config WHERE key = 'auth_code'").first<{
      value: string;
    }>();
    const storedCode = codeRow?.value || "admin";

    if (!(await verify(token, storedCode))) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) return jsonError("Missing url parameter", 400);

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return jsonError("Invalid URL", 400);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return jsonError("Invalid URL", 400);
    }

    if (isBlockedHost(parsed.hostname)) {
      return jsonError("Invalid URL", 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "ModernNav/1.0" },
        redirect: "follow",
      });
    } catch {
      return jsonError("Fetch failed", 502);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) return jsonError("Fetch failed", 502);

    const reader = response.body?.getReader();
    if (!reader) return jsonError("Fetch failed", 502);

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 16 * 1024;

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
    }
    reader.cancel();

    const decoder = new TextDecoder();
    const html = decoder.decode(mergeChunks(chunks, Math.min(totalBytes, MAX_BYTES)));

    const metadata = parseMetadata(html, targetUrl);

    return new Response(JSON.stringify(metadata), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return jsonError("Fetch failed", 502);
  }
};

function mergeChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    const toCopy = Math.min(chunk.length, totalLength - offset);
    result.set(chunk.subarray(0, toCopy), offset);
    offset += toCopy;
    if (offset >= totalLength) break;
  }
  return result;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
