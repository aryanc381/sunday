import { z } from 'zod';

// E.164 phone number, for example +919876543210.
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);

// Only the digits of a phone number, so +91 98765 43210 and 919876543210 compare equal.
export const digitsOf = (phone: string | undefined) => (phone ?? '').replace(/\D/g, '');

// Turns a number as the owner said it into +country-code form; a 10-digit number is an Indian mobile number.
export function toE164(input: string) {
  const digits = digitsOf(input);
  if (digits.length === 10) return phoneSchema.safeParse(`+91${digits}`);
  if (digits.length === 11 && digits.startsWith('0')) return phoneSchema.safeParse(`+91${digits.slice(1)}`);
  return phoneSchema.safeParse(`+${digits}`);
}
