import { describe, expect, it } from 'vitest';
import { buildTypedQrPayload } from '../utils/typedQrPayload';

describe('typed QR payloads', () => {
  it('adds HTTPS to bare hostnames and rejects unsupported URL schemes', () => {
    expect(buildTypedQrPayload({ kind: 'url', url: 'example.com/path' })).toBe('https://example.com/path');
    expect(() => buildTypedQrPayload({ kind: 'url', url: 'javascript:alert(1)' })).toThrow('Only HTTP and HTTPS URLs are supported.');
    expect(() => buildTypedQrPayload({ kind: 'url', url: 'not a URL' })).toThrow('Enter a valid URL.');
  });

  it('escapes Wi-Fi fields and supports open networks', () => {
    expect(buildTypedQrPayload({
      kind: 'wifi',
      ssid: 'Store;Guest',
      password: 'pa:ss,word',
      security: 'WPA',
      hidden: true,
    })).toBe('WIFI:T:WPA;S:Store\\;Guest;P:pa\\:ss\\,word;H:true;;');
    expect(buildTypedQrPayload({ kind: 'wifi', ssid: 'Free WiFi', security: 'nopass' }))
      .toBe('WIFI:T:nopass;S:Free WiFi;H:false;;');
    expect(() => buildTypedQrPayload({ kind: 'wifi', ssid: 'secure', security: 'WPA' }))
      .toThrow('Password is required.');
  });

  it('builds escaped vCard contacts with optional fields', () => {
    expect(buildTypedQrPayload({
      kind: 'contact',
      name: 'Jane Doe',
      organization: 'A;B, Inc',
      contactPhone: '+1 (555) 0100',
      contactEmail: 'jane@example.com',
    })).toBe([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Jane Doe',
      'ORG:A\\;B\\, Inc',
      'TEL:+15550100',
      'EMAIL:jane@example.com',
      'END:VCARD',
    ].join('\r\n'));
  });

  it('encodes email, phone, SMS, and geographic payloads', () => {
    expect(buildTypedQrPayload({ kind: 'email', email: 'a@example.com', subject: 'Hi there', body: 'Hello!' }))
      .toBe('mailto:a@example.com?subject=Hi+there&body=Hello%21');
    expect(buildTypedQrPayload({ kind: 'phone', phone: '+1 (555) 0100' })).toBe('tel:+15550100');
    expect(buildTypedQrPayload({ kind: 'sms', phone: '+1 555 0100', body: 'Hello there' }))
      .toBe('sms:+15550100?body=Hello%20there');
    expect(buildTypedQrPayload({ kind: 'geo', latitude: '37.7749', longitude: '-122.4194' }))
      .toBe('geo:37.7749,-122.4194');
  });

  it('validates address and coordinate bounds', () => {
    expect(() => buildTypedQrPayload({ kind: 'email', email: 'invalid' })).toThrow('Enter a valid email address.');
    expect(() => buildTypedQrPayload({ kind: 'phone', phone: 'abc' })).toThrow('Enter a phone number using digits and common phone punctuation.');
    expect(() => buildTypedQrPayload({ kind: 'geo', latitude: '91', longitude: '0' })).toThrow('Latitude must be between -90 and 90.');
    expect(() => buildTypedQrPayload({ kind: 'geo', latitude: '0', longitude: '181' })).toThrow('Longitude must be between -180 and 180.');
  });
});
