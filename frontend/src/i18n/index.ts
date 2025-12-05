import es from './translations/es.json';

type Locale = 'es';

const translations: Record<Locale, Record<string, unknown>> = {
  es,
};

let currentLocale: Locale = 'es';

export const setLocale = (locale: Locale) => {
  if (translations[locale]) {
    currentLocale = locale;
  }
};

const getNestedValue = (obj: Record<string, unknown>, path: string[]) => {
  return path.reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
};

const applyParams = (value: string, params: Record<string, string | number>) => {
  return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
    const pattern = new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g');
    return acc.replace(pattern, String(paramValue));
  }, value);
};

export const t = (key: string, params: Record<string, string | number> = {}): string => {
  const segments = key.split('.');
  const localeTable = translations[currentLocale];
  const value = getNestedValue(localeTable, segments);
  if (typeof value === 'string') {
    return applyParams(value, params);
  }
  return key;
};

export type SupportedLocale = Locale;
