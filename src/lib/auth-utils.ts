const ALLOWED_DOMAINS = ['.ac.ke', '.edu'];

export function isUniversityEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  return ALLOWED_DOMAINS.some((domain) => lower.endsWith(domain));
}

export const DOMAIN_ERROR_MESSAGE =
  'This platform is restricted to verified university students.';
