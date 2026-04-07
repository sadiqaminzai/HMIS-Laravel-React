export type VerificationType = 'prescription' | 'patient' | 'lab-report' | 'transaction';

export const getPublicBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};

export const buildVerificationUrl = (type: VerificationType, token?: string | null): string => {
  if (!token) return '';
  const base = getPublicBaseUrl();
  if (!base) return '';
  return `${base}/verify/${type}/${token}`;
};
