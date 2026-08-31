import { describe, expect, it } from 'vitest';

import {
  CODE_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  describeAuthError,
  formatCooldown,
  isCompleteCode,
  isProbablyEmail,
  maskEmail,
  normalizeCode,
  parseRetryAfter,
} from '@/cloud/authErrors';

/**
 * The sign-in screen's decisions, tested without a network or a configured
 * Supabase project. What cannot be covered here is listed in the README under
 * "Checks that need a live project".
 */

describe('explaining auth failures', () => {
  it('treats a failed fetch as a connection problem, not a bad code', () => {
    const failure = describeAuthError(new TypeError('Failed to fetch'), 'verify');
    expect(failure.kind).toBe('offline');
    expect(failure.message).toMatch(/connection/i);
  });

  it('recognises Supabase’s retryable fetch error by name', () => {
    const failure = describeAuthError({ name: 'AuthRetryableFetchError', message: '' }, 'request');
    expect(failure.kind).toBe('offline');
  });

  it('explains an expired or wrong code in one sentence', () => {
    for (const error of [
      { code: 'otp_expired', message: 'Token has expired or is invalid' },
      { message: 'Token has expired or is invalid' },
      { message: 'Invalid token' },
    ]) {
      const failure = describeAuthError(error, 'verify');
      expect(failure.kind).toBe('bad-code');
      expect(failure.message).toMatch(/not valid|expired/i);
    }
  });

  it('never relays the provider’s raw wording', () => {
    const failure = describeAuthError({ message: 'Token has expired or is invalid' }, 'verify');
    expect(failure.message).not.toContain('Token has expired or is invalid');
  });

  it('reads the server’s own backoff out of a rate-limit message', () => {
    const failure = describeAuthError(
      { message: 'For security purposes, you can only request this after 46 seconds.' },
      'request',
    );
    expect(failure.kind).toBe('rate-limited');
    expect(failure.retryAfter).toBe(46);
    expect(failure.message).toContain('46');
  });

  it('handles a rate limit with no stated delay', () => {
    const failure = describeAuthError({ code: 'over_email_send_rate_limit', message: 'rate limit' }, 'request');
    expect(failure.kind).toBe('rate-limited');
    expect(failure.retryAfter).toBeUndefined();
  });

  it('separates a rejected project from a rejected code', () => {
    expect(describeAuthError({ code: 'signup_disabled', message: 'Signups not allowed for otp' }, 'request').kind)
      .toBe('rejected');
    expect(describeAuthError({ message: 'Email logins are disabled' }, 'request').kind).toBe('rejected');
  });

  it('flags a malformed address before blaming the code', () => {
    expect(describeAuthError({ code: 'validation_failed', message: 'Unable to validate email address' }, 'request').kind)
      .toBe('bad-email');
  });

  it('falls back to step-appropriate wording for anything unrecognised', () => {
    expect(describeAuthError({ message: 'kaboom' }, 'request').message).toMatch(/could not be sent/i);
    expect(describeAuthError({ message: 'kaboom' }, 'verify').message).toMatch(/could not be confirmed/i);
  });

  it('does not throw on null or a bare string', () => {
    expect(() => describeAuthError(null, 'request')).not.toThrow();
    expect(() => describeAuthError('nope', 'verify')).not.toThrow();
    expect(describeAuthError(null, 'request').kind).toBe('unknown');
  });

  it('parses only a sane retry delay', () => {
    expect(parseRetryAfter('after 12 seconds')).toBe(12);
    expect(parseRetryAfter('after 1 second')).toBe(1);
    expect(parseRetryAfter('no number here')).toBeUndefined();
  });
});

describe('email field', () => {
  it('accepts ordinary addresses', () => {
    for (const value of ['a@b.co', 'fernando@example.com', 'first.last+tag@sub.example.co.uk']) {
      expect(isProbablyEmail(value), value).toBe(true);
    }
  });

  it('rejects obvious typos before making anyone wait on a round trip', () => {
    for (const value of ['', '   ', 'nope', 'no@domain', 'two@@at.com', 'has space@x.com', '@x.com']) {
      expect(isProbablyEmail(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('ignores surrounding whitespace', () => {
    expect(isProbablyEmail('  fernando@example.com  ')).toBe(true);
  });
});

describe('masking the destination', () => {
  it('keeps the domain and enough of the name to recognise it', () => {
    const masked = maskEmail('fernando@example.com');
    expect(masked).toContain('@example.com');
    expect(masked).not.toContain('fernando');
    expect(masked.startsWith('fe')).toBe(true);
    expect(masked.endsWith('o@example.com')).toBe(true);
  });

  it('still masks very short names', () => {
    expect(maskEmail('ab@x.com')).toBe('a•@x.com');
    expect(maskEmail('abcd@x.com')).toBe('a•••@x.com');
  });

  it('leaves something that is not an address alone', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
    expect(maskEmail('')).toBe('');
  });

  it('uses the last @ so a plus-tag cannot confuse it', () => {
    expect(maskEmail('first+tag@example.com')).toContain('@example.com');
  });
});

describe('code field', () => {
  it('keeps only digits, capped at the code length', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('12-34-56')).toBe('123456');
    expect(normalizeCode('1234567890')).toBe('123456');
    expect(normalizeCode('abc')).toBe('');
  });

  it('survives a pasted code with surrounding text', () => {
    expect(normalizeCode('Your code is 004821.')).toBe('004821');
  });

  it('preserves a leading zero', () => {
    expect(normalizeCode('004821')).toBe('004821');
    expect(isCompleteCode('004821')).toBe(true);
  });

  it('only counts a full-length code as complete', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123456')).toBe(true);
    expect(CODE_LENGTH).toBe(6);
  });
});

describe('resend cooldown', () => {
  it('formats seconds and minutes', () => {
    expect(formatCooldown(0)).toBe('');
    expect(formatCooldown(9)).toBe('9s');
    expect(formatCooldown(45)).toBe('45s');
    expect(formatCooldown(60)).toBe('1m');
    expect(formatCooldown(90)).toBe('1m 30s');
  });

  it('starts from a sane default', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBeGreaterThanOrEqual(30);
    expect(RESEND_COOLDOWN_SECONDS).toBeLessThanOrEqual(120);
  });
});
