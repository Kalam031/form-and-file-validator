// Language packs: FVLocales.use('de'). Load dist/locales/<code>.js (or all.js) after the bundle, or import the pack in Node.
export interface LocalePack {
    name?: string;
    dir?: 'ltr' | 'rtl';
    /** FormValidator messages by rule type ({min} {max} {step} placeholders). */
    form?: Record<string, string>;
    /** FileValidator messages by error code ({size} {max} ... placeholders). */
    file?: Record<string, string>;
    /** Translations of English fragments used inside messages and the widget; plural sentences ('status.added') are objects keyed by CLDR category. */
    phrases?: Record<string, string | Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>>>;
    units?: { B?: string; KB?: string; MB?: string; GB?: string };
    /** Extra or overriding messages for jQuery Validation methods ({0} {1} placeholders). */
    jquery?: Record<string, string>;
}
export interface LocaleInfo { code: string; name: string; dir: 'ltr' | 'rtl' }
export interface LocalesStatic {
    readonly version: string;
    readonly current: string;
    register(code: string, pack: LocalePack): LocalePack;
    /** Switch every message to this language; `{ document: true }` also sets <html lang dir>. use('en') restores English. */
    use(code: string, options?: { document?: boolean }): LocaleInfo;
    /** The visitor's language (navigator.languages, region falls back to the base language), else `fallback` (default 'en'). */
    auto(fallback?: string, options?: { document?: boolean }): LocaleInfo;
    reapply(): void;
    get(code: string): LocalePack | null;
    list(): LocaleInfo[];
    keys(): { form: string[]; file: string[]; phrases: string[] };
}
