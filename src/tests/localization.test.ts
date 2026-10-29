import { describe, expect, it } from 'vitest';
import {
  getInitialLocale,
  getTranslationLocale,
  isRightToLeftLocale,
  isSupportedLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  translate,
  translateAccessibility,
  translateDatabaseImport,
  translateDashboardAction,
  translateTemplateWizard,
} from '../i18n/localization';

describe('localization foundation', () => {
  it('exposes the requested 32 locale choices with stable display names', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(32);
    expect(new Set(SUPPORTED_LOCALES).size).toBe(32);
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
      expect(isSupportedLocale(locale)).toBe(true);
    });
  });

  it('prefers a valid saved locale and falls back from regional browser preferences', () => {
    expect(getInitialLocale('fr', 'en-US')).toBe('fr');
    expect(getInitialLocale('not-a-locale', 'es-MX')).toBe('es');
    expect(getInitialLocale(null, 'ja-JP')).toBe('ja');
    expect(getInitialLocale(null, 'unsupported')).toBe('en');
  });

  it('provides a native-language navigation catalog for every supported locale', () => {
    expect(translate('fr', 'projectHome')).toBe('Accueil des projets');
    expect(translate('es', 'dashboard')).toBe('Panel');
    expect(translate('ja', 'projectHome')).not.toBe(translate('en', 'projectHome'));
    for (const locale of SUPPORTED_LOCALES) {
      expect(getTranslationLocale(locale)).toBe(locale);
      expect(translate(locale, 'projectHome')).not.toBe('');
      if (locale !== 'en') expect(translate(locale, 'language')).not.toBe(translate('en', 'language'));
      expect(translate(locale, 'productLine')).not.toBe('');
      expect(translate(locale, 'createTemplate')).not.toBe('');
      for (const key of [
        'dataTab',
        'tiersTab',
        'assortmentsTab',
        'multiSlotsTab',
        'sheetImpositionTab',
        'calibrationTab',
        'proofTab',
      ] as const) {
        expect(translate(locale, key)).not.toBe('');
      }
      if (locale !== 'en') {
        expect(translate(locale, 'productLine')).not.toBe(translate('en', 'productLine'));
        expect(translate(locale, 'createTemplate')).not.toBe(translate('en', 'createTemplate'));
      }
    }
  });

  it('marks right-to-left interface locales', () => {
    expect(isRightToLeftLocale('ar')).toBe(true);
    expect(isRightToLeftLocale('he')).toBe(true);
    expect(isRightToLeftLocale('en')).toBe(false);
  });

  it('provides translated audit-log controls for every supported locale', () => {
    const auditKeys = [
      'auditTitle',
      'auditSubtitle',
      'auditFilterAll',
      'auditFilterCreate',
      'auditFilterUpdate',
      'auditFilterPrint',
      'auditFilterExport',
      'auditLoadError',
      'auditExport',
      'auditClear',
      'auditEmpty',
      'system',
      'close',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of auditKeys) {
        expect(translate(locale, key)).not.toBe('');
        expect(translate(locale, key)).not.toBe(key);
        if (locale !== 'en' && key !== 'system') {
          expect(translate(locale, key)).not.toBe(translate('en', key));
        }
      }
    }
  });

  it('provides translated external database import controls for every supported locale', () => {
    const databaseKeys = [
      'title',
      'readOnlyNotice',
      'browserNotice',
      'databaseType',
      'databasePath',
      'host',
      'port',
      'databaseName',
      'schema',
      'username',
      'password',
      'tlsAuthority',
      'tlsVerification',
      'chooseFile',
      'listTables',
      'connecting',
      'loadMapping',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of databaseKeys) {
        expect(translateDatabaseImport(locale, key)).not.toBe('');
        expect(translateDatabaseImport(locale, key)).not.toBe(key);
      }
      if (locale !== 'en') {
        for (const key of ['title', 'readOnlyNotice', 'browserNotice'] as const) {
          expect(translateDatabaseImport(locale, key)).not.toBe(translateDatabaseImport('en', key));
        }
      }
    }
  });

  it('provides translated accessibility dialog and tooltip controls for every supported locale', () => {
    const accessibilityKeys = [
      'title',
      'subtitle',
      'close',
      'tooltipSection',
      'enableTooltips',
      'tooltipHelp',
      'hoverDelay',
      'tooltipOpacity',
      'autoDismiss',
      'gridSection',
      'gridSensitivity',
      'themeSection',
      'lightTheme',
      'darkTheme',
      'highContrastTheme',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of accessibilityKeys) {
        expect(translateAccessibility(locale, key)).not.toBe('');
        expect(translateAccessibility(locale, key)).not.toBe(key);
      }
      if (locale !== 'en') {
        expect(translateAccessibility(locale, 'title')).not.toBe(translateAccessibility('en', 'title'));
      }
    }
  });

  it('provides translated dashboard project actions for every supported locale', () => {
    const dashboardKeys = [
      'zplWorkbench',
      'catalogImport',
      'printHistory',
      'databaseBackup',
      'databaseRestore',
      'nativeDatabaseRestore',
      'unencryptedDatabase',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      for (const key of dashboardKeys) {
        expect(translateDashboardAction(locale, key)).not.toBe('');
        expect(translateDashboardAction(locale, key)).not.toBe(key);
      }
      if (locale !== 'en') {
        expect(translateDashboardAction(locale, 'databaseBackup'))
          .not.toBe(translateDashboardAction('en', 'databaseBackup'));
      }
    }
  });

  it('provides translated new-template wizard labels for every supported locale', () => {
    const wizardKeys = ['title', 'subtitle', 'presets', 'name', 'defaultName', 'width', 'height'] as const;
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of wizardKeys) {
        expect(translateTemplateWizard(locale, key)).not.toBe('');
        expect(translateTemplateWizard(locale, key)).not.toBe(key);
      }
      if (locale !== 'en') {
        expect(translateTemplateWizard(locale, 'title')).not.toBe(translateTemplateWizard('en', 'title'));
      }
    }
  });
});
