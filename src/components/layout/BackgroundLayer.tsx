'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Replaceable atmospheric background.
 *
 * Each route names a background "slot". Which file fills a slot is declared in
 * public/backgrounds/manifest.json, so adding artwork is a drop-in plus one
 * line of JSON - no code change and no rebuild.
 *
 * The manifest is deliberate rather than convention-over-configuration:
 * guessing at /backgrounds/<slot>.jpg would fire a request for a file that is
 * not there on a default install, and a missing image logs a console error.
 * With a manifest, a default install makes no image request at all and falls
 * back to the CSS atmosphere in globals.css.
 *
 * Whatever plate is supplied sits behind a dark overlay and a vignette, so
 * panel text keeps its contrast against any artwork.
 */

const SLOT_BY_ROUTE: Record<string, string> = {
  '/quests': 'library-hall',
  '/skills': 'grand-atrium',
  '/abilities': 'rotunda',
  '/inventory': 'archive-room',
  '/character': 'observatory',
  '/map': 'library-hall',
};

interface Manifest {
  plates?: Record<string, string>;
}

/** Fetched once per session and shared by every navigation. */
let manifestPromise: Promise<Manifest> | null = null;

function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('/backgrounds/manifest.json', { cache: 'force-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<Manifest>) : { plates: {} }))
      // A missing or malformed manifest is not an error condition: it simply
      // means no artwork has been installed yet.
      .catch(() => ({ plates: {} }));
  }
  return manifestPromise;
}

export function BackgroundLayer() {
  const pathname = usePathname();
  const [plates, setPlates] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void loadManifest().then((manifest) => {
      if (alive) setPlates(manifest.plates ?? {});
    });
    return () => {
      alive = false;
    };
  }, []);

  const slot = SLOT_BY_ROUTE[pathname] ?? 'library-hall';
  const file = plates[slot];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Painted fallback. Always present, so a missing plate is never a hole. */}
      <div className="bg-atmosphere absolute inset-0" />

      {file && (
        <div
          key={slot}
          className="absolute inset-0 bg-cover bg-center opacity-70 transition-opacity duration-[250ms]"
          style={{ backgroundImage: `url("/backgrounds/${file}")` }}
        />
      )}

      {/* Dark overlay + vignette: keeps ivory text legible over any plate. */}
      <div className="absolute inset-0 bg-ink-950/55" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(72% 58% at 50% 42%, transparent 0%, rgba(3,5,10,0.55) 78%, rgba(3,5,10,0.85) 100%)',
        }}
      />

      {/* Fine grain, so the large near-black fields do not band. */}
      <div className="bg-grain absolute inset-0" />
    </div>
  );
}
