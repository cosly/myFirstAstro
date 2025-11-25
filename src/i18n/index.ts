import nl from './translations/nl.json';
import en from './translations/en.json';
import es from './translations/es.json';

export type Locale = 'nl' | 'en' | 'es';

export const defaultLocale: Locale = 'nl';

export const locales: Locale[] = ['nl', 'en', 'es'];

export const localeNames: Record<Locale, string> = {
  nl: 'Nederlands',
  en: 'English',
  es: 'Español',
};

const translations: Record<Locale, typeof nl> = {
  nl,
  en,
  es,
};

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string
      ? T[K] extends object
        ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
        : `${K}`
      : never
    }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<typeof nl>;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return key as fallback
    }
  }

  return typeof current === 'string' ? current : path;
}

/**
 * Get translation for a key
 */
export function t(key: string, locale: Locale = defaultLocale, params?: Record<string, string | number>): string {
  const translation = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);

  if (!params) return translation;

  // Replace parameters like {name} or {count}
  return translation.replace(/\{(\w+)\}/g, (_, paramKey) => {
    return params[paramKey]?.toString() ?? `{${paramKey}}`;
  });
}

/**
 * Create a translator function bound to a specific locale
 */
export function createTranslator(locale: Locale) {
  return (key: string, params?: Record<string, string | number>) => t(key, locale, params);
}

/**
 * Get all translations for a locale
 */
export function getTranslations(locale: Locale) {
  return translations[locale];
}

/**
 * Detect locale from Accept-Language header
 */
export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, priority = 'q=1'] = lang.trim().split(';');
      return {
        code: code.split('-')[0].toLowerCase(),
        priority: parseFloat(priority.replace('q=', '')),
      };
    })
    .sort((a, b) => b.priority - a.priority);

  for (const { code } of languages) {
    if (locales.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return defaultLocale;
}

/**
 * Get locale from cookie
 */
export function getLocaleFromCookie(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/locale=(\w+)/);
  if (match && locales.includes(match[1] as Locale)) {
    return match[1] as Locale;
  }

  return null;
}

/**
 * Get locale from URL search params
 */
export function getLocaleFromUrl(url: URL): Locale | null {
  const lang = url.searchParams.get('lang');
  if (lang && locales.includes(lang as Locale)) {
    return lang as Locale;
  }
  return null;
}

/**
 * Determine the best locale to use
 * Priority: URL param > Cookie > Accept-Language header > Default
 */
export function resolveLocale(
  url: URL,
  cookieHeader: string | null,
  acceptLanguageHeader: string | null
): Locale {
  return (
    getLocaleFromUrl(url) ??
    getLocaleFromCookie(cookieHeader) ??
    detectLocaleFromHeader(acceptLanguageHeader) ??
    defaultLocale
  );
}

const localeMap: Record<Locale, string> = {
  nl: 'nl-NL',
  en: 'en-US',
  es: 'es-ES',
};

/**
 * Format currency based on locale
 */
export function formatCurrencyLocale(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Format date based on locale
 */
export function formatDateLocale(date: Date | string, locale: Locale, style: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (style === 'long') {
    return new Intl.DateTimeFormat(localeMap[locale], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }

  return new Intl.DateTimeFormat(localeMap[locale], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
