export function publicSiteLabel(): string {
  return 'NutriGenius Lite';
}

export function publicSiteUrl(): string {
  return import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173';
}
