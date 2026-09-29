import { HttpError } from './cors.ts';

export type ContactPayload = Readonly<{
  name: string;
  email: string;
  subject: string | null;
  message: string;
  locale: 'fa' | 'en';
  website: string;
}>;

const EMAIL_PATTERN = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
const normalizeText = (value: unknown): string => typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';

function rejectControlCharacters(value: string, fieldName: string): void {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new HttpError(400, 'invalid_input', `${fieldName} contains invalid control characters.`);
  }
}

export function parseContactPayload(value: unknown): ContactPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object.');
  const body = value as Record<string, unknown>;
  const name = normalizeText(body.name);
  const email = normalizeText(body.email).toLowerCase();
  const subject = normalizeText(body.subject) || null;
  const message = normalizeText(body.message);
  const locale = body.locale === 'en' ? 'en' : 'fa';
  const website = normalizeText(body.website);

  if (name.length < 2 || name.length > 100) throw new HttpError(400, 'invalid_name', 'Name must be 2 to 100 characters.');
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'invalid_email', 'A valid email address is required.');
  if (subject && subject.length > 200) throw new HttpError(400, 'invalid_subject', 'Subject must be at most 200 characters.');
  if (message.length < 10 || message.length > 3000) throw new HttpError(400, 'invalid_message', 'Message must be 10 to 3000 characters.');

  rejectControlCharacters(name, 'name');
  rejectControlCharacters(email, 'email');
  if (subject) rejectControlCharacters(subject, 'subject');
  rejectControlCharacters(message, 'message');

  return { name, email, subject, message, locale, website };
}
