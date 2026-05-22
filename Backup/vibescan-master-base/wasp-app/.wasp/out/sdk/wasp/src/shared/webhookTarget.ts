import dns from 'node:dns/promises';
import net from 'node:net';

export type WebhookTargetValidationOptions = {
  allowHttp?: boolean;
  allowLocalHttp?: boolean;
  lookup?: (
    hostname: string,
    options: { all: true },
  ) => Promise<Array<{ address: string; family: number }>>;
};

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.');
}

function isPrivateIpAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const octets = address.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
      return true;
    }

    const [first, second] = octets;
    if (first === 10) return true;
    if (first === 127) return true;
    if (first === 169 && second === 254) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    return false;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('::ffff:127.')
    );
  }

  return true;
}

export async function validateWebhookTargetUrl(
  value: string,
  options: WebhookTargetValidationOptions = {},
): Promise<URL> {
  const url = new URL(value);
  const allowHttp = options.allowHttp ?? false;
  const allowLocalHttp = options.allowLocalHttp ?? false;
  const loopbackHost = isLoopbackHostname(url.hostname);

  if (url.protocol !== 'https:') {
    if (allowHttp) {
      return url;
    }

    if (!(allowLocalHttp && url.protocol === 'http:' && loopbackHost)) {
      throw new Error('Webhook URLs must use https');
    }
  }

  if (allowLocalHttp && loopbackHost) {
    return url;
  }

  const lookup = options.lookup ?? dns.lookup;
  const resolved = (await lookup(url.hostname, { all: true })) as Array<{
    address: string;
    family: number;
  }>;

  if (resolved.some((record: { address: string; family: number }) => isPrivateIpAddress(record.address))) {
    throw new Error('Webhook host resolves to a private address');
  }

  return url;
}
