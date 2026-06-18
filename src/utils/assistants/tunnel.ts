/**
 * Derive the tunnel id from a registered desktop URL. The tunnel service mints
 * public URLs as `https://<tunnel_id>.<subdomain.tld>`, so the id is the first
 * hostname label — but only for genuine public tunnel hosts. Returns null for
 * localhost / bare-IP / self-host URLs (which have no managed tunnel to tear
 * down) and for anything unparseable.
 */
export function extractTunnelId(url: string | undefined | null): string | null {
  if (!url) return null;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (host === 'localhost') return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;

  const labels = host.split('.');
  // A managed tunnel host is `<id>.<subdomain.tld>`: at least three labels.
  if (labels.length < 3) return null;

  const tunnelId = labels[0].trim();
  return tunnelId || null;
}
