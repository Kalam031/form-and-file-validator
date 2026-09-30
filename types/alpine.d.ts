// Alpine plugin: load dist/integrations/alpine.js before Alpine, or `window.FVAlpine(Alpine)` when Alpine is bundled.
export default function register(Alpine: { directive(name: string, handler: (...args: any[]) => void): void }): void;
