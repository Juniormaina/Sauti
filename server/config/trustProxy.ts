import { IncomingMessage } from 'node:http';
import net from 'node:net';

export type TrustProxyInput = boolean | number | string | string[] | undefined | null;

export interface ParsedTrustProxyConfig {
  isValid: boolean;
  reason?: string;
  expressValue: boolean | number | string[];
  mode: 'none' | 'hops' | 'blocklist';
  hops: number;
  blockList: net.BlockList | null;
}

const MAX_TRUSTED_HOPS = 10;

function addNamedSubnet(blockList: net.BlockList, name: string): boolean {
  switch (name) {
    case 'loopback':
      blockList.addSubnet('127.0.0.0', 8, 'ipv4');
      blockList.addAddress('::1', 'ipv6');
      return true;
    case 'linklocal':
      blockList.addSubnet('169.254.0.0', 16, 'ipv4');
      blockList.addSubnet('fe80::', 10, 'ipv6');
      return true;
    case 'uniquelocal':
      blockList.addSubnet('10.0.0.0', 8, 'ipv4');
      blockList.addSubnet('172.16.0.0', 12, 'ipv4');
      blockList.addSubnet('192.168.0.0', 16, 'ipv4');
      blockList.addSubnet('fc00::', 7, 'ipv6');
      return true;
    default:
      return false;
  }
}

export function normalizeIpAddress(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let ip = raw.trim();
  if (!ip) return null;

  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const mapped = ip.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      ip = mapped;
    }
  }

  return net.isIP(ip) !== 0 ? ip : null;
}

function failSafeConfig(reason: string): ParsedTrustProxyConfig {
  return {
    isValid: false,
    reason,
    expressValue: false,
    mode: 'none',
    hops: 0,
    blockList: null,
  };
}

export function parseTrustProxyConfig(input?: TrustProxyInput): ParsedTrustProxyConfig {
  if (input === undefined || input === null || input === false || input === 0) {
    return {
      isValid: true,
      expressValue: false,
      mode: 'none',
      hops: 0,
      blockList: null,
    };
  }

  if (input === true) {
    return failSafeConfig('Boolean "true" trust proxy is overly permissive and rejected.');
  }

  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 1 || input > MAX_TRUSTED_HOPS) {
      return failSafeConfig(`Invalid hop count "${input}". Expected integer between 1 and ${MAX_TRUSTED_HOPS}.`);
    }
    return {
      isValid: true,
      expressValue: input,
      mode: 'hops',
      hops: input,
      blockList: null,
    };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'false' || trimmed === '0') {
      return {
        isValid: true,
        expressValue: false,
        mode: 'none',
        hops: 0,
        blockList: null,
      };
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === '*' || lower === 'all' || lower === 'any') {
      return failSafeConfig(`Overly permissive TRUST_PROXY value "${trimmed}" is rejected.`);
    }

    if (/^-?\d+$/.test(trimmed)) {
      const hops = Number(trimmed);
      if (!Number.isInteger(hops) || hops < 1 || hops > MAX_TRUSTED_HOPS) {
        return failSafeConfig(`Invalid TRUST_PROXY hop count "${trimmed}". Expected 1..${MAX_TRUSTED_HOPS}.`);
      }
      return {
        isValid: true,
        expressValue: hops,
        mode: 'hops',
        hops,
        blockList: null,
      };
    }

    const entries = trimmed.split(',').map((item) => item.trim());
    return parseSubnetEntries(entries);
  }

  if (Array.isArray(input)) {
    return parseSubnetEntries(input.map((item) => (typeof item === 'string' ? item.trim() : '')));
  }

  return failSafeConfig('Unsupported trust proxy configuration type.');
}

function parseSubnetEntries(entries: string[]): ParsedTrustProxyConfig {
  if (entries.length === 0 || entries.some((e) => !e)) {
    return failSafeConfig('TRUST_PROXY list cannot contain empty entries.');
  }

  const blockList = new net.BlockList();
  const normalizedList: string[] = [];

  for (const entry of entries) {
    const lower = entry.toLowerCase();
    if (addNamedSubnet(blockList, lower)) {
      normalizedList.push(lower);
      continue;
    }

    if (entry.includes('/')) {
      const parts = entry.split('/');
      if (parts.length !== 2) {
        return failSafeConfig(`Invalid CIDR entry "${entry}" in TRUST_PROXY.`);
      }
      const [rawAddr, rawPrefix] = parts;
      const addr = normalizeIpAddress(rawAddr);
      if (!addr || !/^\d+$/.test(rawPrefix)) {
        return failSafeConfig(`Invalid CIDR entry "${entry}" in TRUST_PROXY.`);
      }
      const prefix = Number(rawPrefix);
      const isV4 = net.isIPv4(addr);
      const maxPrefix = isV4 ? 32 : 128;

      if (prefix <= 0 || prefix > maxPrefix) {
        return failSafeConfig(`Overly broad or invalid CIDR prefix "/${rawPrefix}" in TRUST_PROXY.`);
      }

      try {
        blockList.addSubnet(addr, prefix, isV4 ? 'ipv4' : 'ipv6');
        normalizedList.push(`${addr}/${prefix}`);
      } catch {
        return failSafeConfig(`Failed to compile CIDR "${entry}" in TRUST_PROXY.`);
      }
      continue;
    }

    const addr = normalizeIpAddress(entry);
    if (!addr) {
      return failSafeConfig(`Invalid IP or subnet "${entry}" in TRUST_PROXY.`);
    }
    const isV4 = net.isIPv4(addr);
    try {
      blockList.addAddress(addr, isV4 ? 'ipv4' : 'ipv6');
      normalizedList.push(addr);
    } catch {
      return failSafeConfig(`Invalid IP address "${entry}" in TRUST_PROXY.`);
    }
  }

  return {
    isValid: true,
    expressValue: normalizedList,
    mode: 'blocklist',
    hops: 0,
    blockList,
  };
}

function isTrustedIp(ip: string, blockList: net.BlockList): boolean {
  const family = net.isIPv4(ip) ? 'ipv4' : 'ipv6';
  try {
    return blockList.check(ip, family);
  } catch {
    return false;
  }
}

export function resolveClientIp(
  request: Pick<IncomingMessage, 'headers' | 'socket'>,
  trustProxy: ParsedTrustProxyConfig | TrustProxyInput
): string {
  const config =
    trustProxy &&
    typeof trustProxy === 'object' &&
    !Array.isArray(trustProxy) &&
    'mode' in trustProxy
      ? trustProxy
      : parseTrustProxyConfig(trustProxy);

  const remoteIp = normalizeIpAddress(request.socket?.remoteAddress);
  if (!remoteIp) {
    return 'unknown';
  }

  if (!config.isValid || config.mode === 'none') {
    return remoteIp;
  }

  const rawXff = request.headers['x-forwarded-for'];
  const xffString = Array.isArray(rawXff) ? rawXff.join(',') : rawXff;
  if (!xffString || typeof xffString !== 'string') {
    return remoteIp;
  }

  const xffParts = xffString
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (xffParts.length === 0) {
    return remoteIp;
  }

  if (config.mode === 'hops') {
    // Walk right-to-left up to `config.hops` entries added by trusted proxies.
    let current = remoteIp;
    let remaining = config.hops;
    for (let i = xffParts.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const candidate = normalizeIpAddress(xffParts[i]);
      if (!candidate) {
        return current;
      }
      current = candidate;
      remaining -= 1;
    }
    return current;
  }

  if (config.mode === 'blocklist' && config.blockList) {
    // Only consider X-Forwarded-For when the direct TCP peer is an explicitly trusted proxy.
    if (!isTrustedIp(remoteIp, config.blockList)) {
      return remoteIp;
    }

    let current = remoteIp;
    for (let i = xffParts.length - 1; i >= 0; i -= 1) {
      const candidate = normalizeIpAddress(xffParts[i]);
      if (!candidate) {
        return current;
      }
      current = candidate;
      if (!isTrustedIp(candidate, config.blockList)) {
        return candidate;
      }
    }
    return current;
  }

  return remoteIp;
}
