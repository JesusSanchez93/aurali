import { lookup as dnsLookup } from 'dns/promises';
import nodemailer from 'nodemailer';
import type { SmtpSecurity } from '../types';

export interface SmtpTransportConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
}

/**
 * Nodemailer resolves the SMTP host itself (via `dns.resolve4`/`resolve6`,
 * not the OS resolver) and only falls back to `dns.lookup` when *both*
 * queries error — so a host that has a working AAAA record but no real IPv6
 * route (common on plenty of home/office networks) can still end up with
 * Nodemailer handing `net.connect` an unreachable IPv6 address, surfacing as
 * ECONNREFUSED/EHOSTUNREACH even though the server is reachable over IPv4.
 * There's no config knob in Nodemailer to force v4-only, so we resolve the
 * address ourselves via the OS resolver (which mirrors what any other TCP
 * client on the machine would successfully connect to) and hand Nodemailer
 * the literal IP — passing the original hostname as `servername` so TLS SNI
 * and certificate validation still target the real domain.
 */
async function resolveIPv4Host(host: string): Promise<{ host: string; servername?: string }> {
  try {
    const { address } = await dnsLookup(host, { family: 4 });
    return { host: address, servername: host };
  } catch {
    // No IPv4 address available (or lookup failed) — let Nodemailer resolve
    // it as usual rather than hard-failing here.
    return { host };
  }
}

/**
 * Builds a fresh Nodemailer transport for a single operation. Never reused
 * or kept warm across invocations — serverless functions (Vercel) can be
 * torn down between requests, and a pooled/persistent SMTP connection would
 * leak sockets or send through a stale one. Callers must `transport.close()`
 * once done.
 */
export async function createSmtpTransport(config: SmtpTransportConfig) {
  const { host, servername } = await resolveIPv4Host(config.host);

  return nodemailer.createTransport({
    host,
    servername,
    port: config.port,
    // 'ssl_tls' (typically :465) connects TLS-wrapped from the start;
    // 'starttls' (typically :587) connects plain then upgrades — nodemailer
    // does this automatically when secure:false and the server advertises
    // STARTTLS; 'none' is a deliberate escape hatch for local/internal
    // relays that don't support encryption at all.
    secure: config.security === 'ssl_tls',
    requireTLS: config.security === 'starttls',
    ignoreTLS: config.security === 'none',
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Verifies host/port/security/auth without sending anything. */
export async function verifySmtpConnection(config: SmtpTransportConfig): Promise<void> {
  const transport = await createSmtpTransport(config);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
