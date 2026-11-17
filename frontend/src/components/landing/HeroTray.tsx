import type { RefObject } from 'react';

export interface HeroTrayProps {
  heroRef: RefObject<HTMLElement | null>;
  onMode: (m: 'static' | 'gl') => void;
  onDeveloped: (d: boolean) => void;
}

/** The Latent Image tray. Without WebGL the hero stays a fully developed static print. */
export function HeroTray(props: HeroTrayProps) {
  void props;
  return null;
}
