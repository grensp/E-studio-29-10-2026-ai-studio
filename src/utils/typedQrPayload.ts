export type TypedQrPayloadKind = 'url' | 'wifi' | 'contact' | 'email' | 'phone' | 'sms' | 'geo';

export interface TypedQrPayloadInput {
  kind: TypedQrPayloadKind;
  url?: string;
  ssid?: string;
  password?: string;
  security?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
  name?: string;
  organization?: string;
  contactPhone?: string;
  contactEmail?: string;
  email?: string;
  subject?: string;
  body?: string;
  phone?: string;
  latitude?: string;
  longitude?: string;
}

function required(value: string | undefined, label: string): string {
  const result = value?.trim();
  if (!result) throw new Error(`${label} is required.`);
  if (/[\u0000-\u001f\u007f]/.test(result)) throw new Error(`${label} contains unsupported control characters.`);
  return result;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"'])/g, '\\$1');
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([;,])/g, '\\$1');
}

function validateEmail(value: string): string {
  const email = required(value, 'Email address');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

function validatePhone(value: string): string {
  const phone = required(value, 'Phone number');
  if (!/^\+?[0-9().\s-]+$/.test(phone) || !/\d/.test(phone)) throw new Error('Enter a phone number using digits and common phone punctuation.');
  return phone.replace(/[\s().-]/g, '');
}

export function buildTypedQrPayload(input: TypedQrPayloadInput): string {
  switch (input.kind) {
    case 'url': {
      const value = required(input.url, 'URL');
      const explicitScheme = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
      const hasHostPort = /^[^/:\s]+:\d+(?:\/|$)/.test(value);
      if (explicitScheme && !hasHostPort && !['http', 'https'].includes(explicitScheme)) {
        throw new Error('Only HTTP and HTTPS URLs are supported.');
      }
      const normalized = explicitScheme && !hasHostPort ? value : `https://${value}`;
      let parsed: URL;
      try {
        parsed = new URL(normalized);
      } catch {
        throw new Error('Enter a valid URL.');
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
      return normalized;
    }
    case 'wifi': {
      const ssid = escapeWifi(required(input.ssid, 'Network name'));
      const security = input.security || 'WPA';
      const password = security === 'nopass' ? '' : escapeWifi(required(input.password, 'Password'));
      return `WIFI:T:${security};S:${ssid};${password ? `P:${password};` : ''}H:${input.hidden ? 'true' : 'false'};;`;
    }
    case 'contact': {
      const name = required(input.name, 'Contact name');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVCard(name)}`];
      if (input.organization?.trim()) lines.push(`ORG:${escapeVCard(required(input.organization, 'Organization'))}`);
      if (input.contactPhone?.trim()) lines.push(`TEL:${validatePhone(input.contactPhone)}`);
      if (input.contactEmail?.trim()) lines.push(`EMAIL:${validateEmail(input.contactEmail)}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    }
    case 'email': {
      const email = validateEmail(input.email || '');
      const params = new URLSearchParams();
      if (input.subject?.trim()) params.set('subject', required(input.subject, 'Subject'));
      if (input.body?.trim()) params.set('body', required(input.body, 'Message'));
      const query = params.toString();
      return `mailto:${email}${query ? `?${query}` : ''}`;
    }
    case 'phone':
      return `tel:${validatePhone(input.phone || '')}`;
    case 'sms': {
      const phone = validatePhone(input.phone || '');
      const body = input.body?.trim() ? `?body=${encodeURIComponent(required(input.body, 'Message'))}` : '';
      return `sms:${phone}${body}`;
    }
    case 'geo': {
      const latitude = Number(required(input.latitude, 'Latitude'));
      const longitude = Number(required(input.longitude, 'Longitude'));
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude must be between -90 and 90.');
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude must be between -180 and 180.');
      return `geo:${latitude},${longitude}`;
    }
  }
}
