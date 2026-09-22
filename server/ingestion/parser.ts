import type { RawEvent } from "@/lib/validation/ingestion";
import type { ParsedEvent } from "@/types/ingestion";

/**
 * Securis - Ingestion parser
 *
 * The parser translates a *raw* event into a canonical, source-agnostic set of
 * fields. Different producers describe the same concepts with different key
 * names (`user` vs `username` vs `principal`, `ip` vs `client_ip`, ...), so the
 * parser is where that vocabulary is reconciled.
 *
 * Rules:
 *   - Explicit, top-level canonical fields always win over derived ones.
 *   - `raw` holds the provider payload; it is parsed by `sourceType` and the
 *     original payload is preserved inside `metadata.raw` for investigations.
 *   - The parser only *maps* fields. It does not decide validity - that is the
 *     normaliser/validator's job - so it never throws on odd input.
 *
 * Connection: called by server/ingestion/pipeline.ts after Zod validation.
 */

/** Return the first defined, non-null value for any of the given keys. */
function pick(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** Coerce an unknown value to a trimmed string, or undefined. */
function str(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

/** Interpret an authentication outcome as a success/failure boolean. */
function outcomeToSuccess(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["success", "succeeded", "ok", "true", "1", "allow", "allowed", "pass"].includes(text)) {
    return true;
  }
  if (["failure", "failed", "error", "false", "0", "deny", "denied", "reject", "rejected"].includes(text)) {
    return false;
  }
  return undefined;
}

/**
 * Extract canonical fields from a provider payload according to `sourceType`.
 * Returns only the fields it could confidently derive.
 */
function deriveFromRaw(input: RawEvent): Partial<ParsedEvent> {
  const raw = input.raw ?? undefined;
  const derived: Partial<ParsedEvent> = {};

  switch (input.sourceType) {
    case "AUTH": {
      const success = outcomeToSuccess(
        pick(raw, ["outcome", "result", "success", "status"]),
      );
      derived.username = str(pick(raw, ["user", "username", "principal", "account", "email"]));
      derived.sourceIp = str(pick(raw, ["ip", "source_ip", "client_ip", "remote_addr", "src_ip"]));
      derived.userAgent = str(pick(raw, ["user_agent", "userAgent", "agent"]));
      derived.resource = str(pick(raw, ["resource", "endpoint", "path"])) ?? "/login";
      derived.action = "LOGIN";
      if (success !== undefined) {
        derived.eventType = success ? "LOGIN_SUCCESS" : "LOGIN_FAILED";
        derived.status = success ? "SUCCESS" : "FAILURE";
      }
      break;
    }

    case "WEB": {
      derived.resource = str(pick(raw, ["path", "url", "uri", "resource", "request_uri"]));
      derived.action = str(pick(raw, ["method", "http_method", "verb"]));
      derived.status = str(pick(raw, ["status", "status_code", "http_status", "response_code"]));
      derived.sourceIp = str(pick(raw, ["ip", "client_ip", "source_ip", "remote_addr"]));
      derived.userAgent = str(pick(raw, ["user_agent", "userAgent", "agent"]));
      derived.eventType = "HTTP_REQUEST";
      break;
    }

    case "API": {
      derived.resource = str(pick(raw, ["endpoint", "path", "route", "url", "resource"]));
      derived.action = str(pick(raw, ["method", "http_method", "verb"]));
      derived.status = str(pick(raw, ["status", "status_code", "code", "response_code"]));
      derived.sourceIp = str(pick(raw, ["ip", "client_ip", "source_ip", "remote_addr"]));
      derived.eventType = "API_REQUEST";
      break;
    }

    case "SERVER": {
      derived.resource = str(pick(raw, ["metric", "check", "component", "resource"]));
      derived.action = "MONITOR";
      derived.eventType = "HEALTH_CHECK";
      break;
    }

    case "DATABASE": {
      derived.resource = str(pick(raw, ["table", "collection", "resource", "object"]));
      derived.action = str(pick(raw, ["operation", "op", "statement", "action"]));
      derived.eventType = "DB_QUERY";
      break;
    }

    case "NETWORK": {
      derived.sourceIp = str(pick(raw, ["src_ip", "source_ip", "src", "source"]));
      derived.destinationIp = str(pick(raw, ["dst_ip", "destination_ip", "dst", "destination"]));
      derived.action = str(pick(raw, ["protocol", "proto"]));
      derived.eventType = "NETWORK_FLOW";
      break;
    }

    case "INFRASTRUCTURE": {
      derived.resource = str(pick(raw, ["component", "service", "host", "resource"]));
      derived.status = str(pick(raw, ["state", "status"]));
      derived.eventType = "INFRA_EVENT";
      break;
    }

    case "APPLICATION": {
      derived.resource = str(pick(raw, ["module", "component", "feature", "resource"]));
      derived.status = str(pick(raw, ["level", "status"]));
      derived.eventType = "APP_EVENT";
      break;
    }
  }

  return derived;
}

/**
 * Parse a validated raw event into a canonical set of fields.
 * Top-level values take precedence; anything missing is filled from `raw`.
 */
export function parseEvent(input: RawEvent): ParsedEvent {
  const derived = deriveFromRaw(input);

  // Merge provider metadata with the preserved raw payload for investigations.
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    ...(input.raw ? { raw: input.raw } : {}),
  };

  return {
    timestamp: input.timestamp,
    source: input.source,
    sourceType: input.sourceType,
    eventType: input.eventType ?? derived.eventType,
    severity: input.severity ?? derived.severity,
    username: input.username ?? derived.username ?? null,
    sourceIp: input.sourceIp ?? derived.sourceIp ?? null,
    destinationIp: input.destinationIp ?? derived.destinationIp ?? null,
    userAgent: input.userAgent ?? derived.userAgent ?? null,
    resource: input.resource ?? derived.resource ?? null,
    action: input.action ?? derived.action ?? null,
    status: input.status ?? derived.status ?? null,
    message: input.message ?? null,
    metadata: Object.keys(metadata).length ? metadata : null,
  };
}
