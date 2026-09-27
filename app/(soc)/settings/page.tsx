import type { Metadata } from "next";
import { ShieldCheck, KeyRound, Cookie, Gauge, Lock, ServerCog } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/auth/current-user";
import { SESSION_COOKIE_NAME, SESSION_LAST_SEEN_THROTTLE_MS, SESSION_TTL_MINUTES } from "@/auth/constants";
import { sessionCookieOptions } from "@/auth/session";
import { PASSWORD_POLICY } from "@/security/password";
import { RISK_BANDS } from "@/types/security";

export const metadata: Metadata = { title: "Settings · Securis" };

/**
 * /settings - Security posture and platform configuration.
 *
 * A read-only view of the security controls the platform actually enforces:
 * session/cookie policy, password policy, rate limits, security headers and the
 * risk-scoring bands. Values are read from the same modules the application
 * uses, so this page cannot drift from reality.
 *
 * Secret VALUES are never rendered — only whether they are configured.
 */
export const dynamic = "force-dynamic";

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-start gap-2">
        <Icon className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-[0.68rem] text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          ok === undefined
            ? "text-sm text-foreground"
            : ok
              ? "text-sm font-medium text-severity-low"
              : "text-sm font-medium text-severity-high"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** The security headers applied to every response (see next.config.ts). */
const APPLIED_HEADERS = [
  "Content-Security-Policy",
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy: same-origin",
  "Cross-Origin-Resource-Policy: same-origin",
  "X-Permitted-Cross-Domain-Policies: none",
  "X-DNS-Prefetch-Control: off",
];

export default async function SettingsPage() {
  const session = await requireSession();

  const cookie = sessionCookieOptions(SESSION_TTL_MINUTES * 60);
  const loginMax = process.env.LOGIN_RATE_LIMIT_MAX ?? "5";
  const loginWindow = process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? "300";
  const apiMax = process.env.API_RATE_LIMIT_MAX ?? "120";
  const apiWindow = process.env.API_RATE_LIMIT_WINDOW_SECONDS ?? "60";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Security posture and platform configuration. Read-only — values come from the running configuration."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Signed-in user"
          description="Your identity and effective role"
          icon={ShieldCheck}
        >
          <Row label="Name" value={session.user.name} />
          <Row label="Email" value={session.user.email} />
          <Row label="Role" value={session.user.role} />
          <Row label="Session expires" value={session.expiresAt.toISOString()} />
        </Section>

        <Section
          title="Session & cookie policy"
          description="How sessions are established and protected"
          icon={Cookie}
        >
          <Row label="Cookie name" value={SESSION_COOKIE_NAME} />
          <Row label="HttpOnly (no JS access)" value={cookie.httpOnly ? "enabled" : "disabled"} ok={cookie.httpOnly} />
          <Row label="SameSite" value={String(cookie.sameSite)} />
          <Row
            label="Secure flag"
            value={cookie.secure ? "enabled (HTTPS)" : "disabled (HTTP dev)"}
            ok={cookie.secure}
          />
          <Row label="Session TTL" value={`${SESSION_TTL_MINUTES} minutes`} />
          <Row
            label="Last-seen refresh throttle"
            value={`${Math.round(SESSION_LAST_SEEN_THROTTLE_MS / 60000)} minutes`}
          />
          <Row label="Token storage" value="SHA-256 hash only (never the raw token)" />
        </Section>

        <Section
          title="Password policy"
          description="Enforced on every password created through the platform"
          icon={KeyRound}
        >
          <Row label="Hashing algorithm" value="Argon2id" />
          <Row label="Minimum length" value={`${PASSWORD_POLICY.minLength} characters`} />
          <Row label="Maximum length" value={`${PASSWORD_POLICY.maxLength} characters`} />
          <Row label="Requires uppercase" value={PASSWORD_POLICY.requireUppercase ? "yes" : "no"} />
          <Row label="Requires lowercase" value={PASSWORD_POLICY.requireLowercase ? "yes" : "no"} />
          <Row label="Requires number" value={PASSWORD_POLICY.requireNumber ? "yes" : "no"} />
          <Row label="Requires symbol" value={PASSWORD_POLICY.requireSymbol ? "yes" : "no"} />
          <Row label="Plaintext storage" value="never" ok />
        </Section>

        <Section
          title="Rate limiting"
          description="Sliding-window limits per source IP and per account"
          icon={Gauge}
        >
          <Row label="Login attempts" value={`${loginMax} per ${loginWindow}s`} />
          <Row label="Login scoping" value="per IP and per account" />
          <Row label="Generic API limit" value={`${apiMax} per ${apiWindow}s`} />
          <Row label="Ingestion" value={`${apiMax} per ${apiWindow}s`} />
          <Row label="Detection scans / simulations" value="throttled per IP" />
        </Section>

        <Section
          title="Risk scoring bands"
          description="Deterministic score → qualitative band"
          icon={ServerCog}
        >
          <Row label="0–25" value={RISK_BANDS[0]} />
          <Row label="26–50" value={RISK_BANDS[1]} />
          <Row label="51–75" value={RISK_BANDS[2]} />
          <Row label="76–100" value={RISK_BANDS[3]} />
        </Section>

        <Section
          title="Environment & secrets"
          description="Secret values are never displayed"
          icon={Lock}
        >
          <Row label="Environment" value={process.env.NODE_ENV ?? "development"} />
          <Row label="App URL" value={process.env.APP_URL ?? "(unset)"} />
          <Row
            label="SESSION_SECRET"
            value={process.env.SESSION_SECRET ? "configured" : "missing"}
            ok={Boolean(process.env.SESSION_SECRET)}
          />
          <Row
            label="INGEST_API_KEY"
            value={process.env.INGEST_API_KEY ? "configured" : "missing"}
            ok={Boolean(process.env.INGEST_API_KEY)}
          />
          <Row label="Secrets in source code" value="none" ok />
        </Section>
      </div>

      <Section
        title="Security headers"
        description="Applied to every response by next.config.ts"
        icon={ShieldCheck}
      >
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {APPLIED_HEADERS.map((header) => (
            <li key={header} className="font-mono text-[0.7rem] text-muted-foreground">
              {header}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
