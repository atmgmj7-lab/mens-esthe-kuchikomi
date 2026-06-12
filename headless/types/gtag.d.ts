export {};

type GtagCommand = "config" | "event" | "js" | "set";

type GtagEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (command: GtagCommand, ...args: unknown[]) => void;
  }
}
