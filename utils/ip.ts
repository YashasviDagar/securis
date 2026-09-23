/**
 * Securis - IP classification helpers
 *
 * Pure functions used by the risk scoring engine to distinguish internal
 * (private/reserved) addresses from publicly routable ones. A detection whose
 * source is a public IP is treated as higher risk than one from the internal
 * network.
 *
 * Note: this is *classification*, not geolocation. Securis makes no claims
 * about the physical location of an address.
 *
 * Connection: server/detection/risk.ts.
 */

/** Is the address a private, loopback, link-local or otherwise reserved IPv4? */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // Malformed: treat as non-routable rather than public.
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** Is the address a loopback, unique-local or link-local IPv6? */
function isPrivateIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // fc00::/7
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  return false;
}

/** True when the address is private, loopback, link-local or reserved. */
export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return true;
  if (trimmed.includes(":")) return isPrivateIpv6(trimmed);
  return isPrivateIpv4(trimmed);
}

/** True when the address is publicly routable (and therefore higher risk). */
export function isPublicIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return false;
  return !isPrivateIp(trimmed);
}
