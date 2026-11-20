import { z } from 'zod';

// E.164 phone number, for example +919876543210.
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);

// Only the digits of a phone number, so +91 98765 43210 and 919876543210 compare equal.
export const digitsOf = (phone: string | undefined) => (phone ?? '').replace(/\D/g, '');
