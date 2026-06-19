import { describe, expect, it } from 'vitest';
import { extractTunnelId } from '@/utils/assistants/tunnel';

describe('extractTunnelId', () => {
  it('extracts the leading hostname label from a managed tunnel URL', () => {
    expect(extractTunnelId('https://abc123.tunnel.unify.ai')).toBe('abc123');
    expect(extractTunnelId('https://abc123.tunnel.unify.ai/desktop/custom.html')).toBe('abc123');
    expect(extractTunnelId('https://seed-17-42.tunnel.unify.ai')).toBe('seed-17-42');
  });

  it('ignores ports and paths on the tunnel host', () => {
    expect(extractTunnelId('https://tun9.relay.unify.ai:8443/x?y=1')).toBe('tun9');
  });

  it('returns null for empty, missing, or unparseable input', () => {
    expect(extractTunnelId(undefined)).toBeNull();
    expect(extractTunnelId(null)).toBeNull();
    expect(extractTunnelId('')).toBeNull();
    expect(extractTunnelId('not a url')).toBeNull();
  });

  it('returns null for localhost and bare-IP hosts (no managed tunnel)', () => {
    expect(extractTunnelId('http://localhost:8090')).toBeNull();
    expect(extractTunnelId('http://127.0.0.1:8090/desktop')).toBeNull();
    expect(extractTunnelId('https://10.0.0.5')).toBeNull();
  });

  it('returns null for apex/two-label hosts that carry no tunnel id', () => {
    expect(extractTunnelId('https://unify.ai')).toBeNull();
    expect(extractTunnelId('https://tunnel.ai')).toBeNull();
  });
});
