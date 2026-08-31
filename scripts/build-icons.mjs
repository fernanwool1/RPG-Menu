/**
 * Derives the runtime icon set from the high-resolution masters.
 *
 *   assets-master/icons/**   1254x1254 originals, never modified, never served
 *   public/assets/icons/**   optimised copies the app actually loads
 *
 * Run with `npm run icons`. Re-runnable: it always rebuilds from the masters,
 * so the generated tree can be deleted at any time.
 *
 * Sizes are chosen from how the icons are actually displayed, allowing for a
 * 3x device pixel ratio:
 *
 *   navigation  22-28px on screen  ->  128px is already ~4.5x
 *   domains     26-52px            ->  256px
 *   abilities   40-80px            ->  256px
 *
 * PNG is kept (never JPEG) because the alpha channel is the whole point: it
 * carries the artwork's shading and is what the CSS mask reads.
 */
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTERS = path.join(root, 'assets-master', 'icons');
const OUT = path.join(root, 'public', 'assets', 'icons');

/** Preview sheets ship in the packages but are not part of the icon set. */
const EXCLUDE = new Set(['preview.png']);

const GROUPS = [
  { from: 'main-navigation-icons', to: 'navigation', size: 128 },
  { from: 'domain-icons', to: 'domains', size: 256 },
  { from: 'ability-icons', to: 'abilities', size: 256, nested: true },
];

async function convert(sourceFile, targetFile, size) {
  const meta = await sharp(sourceFile).metadata();

  // Never upscale past the supplied original.
  const target = Math.min(size, meta.width ?? size, meta.height ?? size);

  await sharp(sourceFile)
    .resize(target, target, {
      fit: 'contain',
      // Transparent padding preserves the square aspect exactly; the symbol is
      // never cropped or stretched.
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(targetFile);

  const { size: bytes } = await stat(targetFile);
  return { target, bytes };
}

async function run() {
  await rm(OUT, { recursive: true, force: true });

  const manifest = {};
  let count = 0;
  let totalBytes = 0;

  for (const group of GROUPS) {
    const sourceDir = path.join(MASTERS, group.from);
    const targetDir = path.join(OUT, group.to);
    await mkdir(targetDir, { recursive: true });

    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && group.nested) {
        const subSource = path.join(sourceDir, entry.name);
        const subTarget = path.join(targetDir, entry.name);
        await mkdir(subTarget, { recursive: true });

        for (const file of await readdir(subSource)) {
          if (!file.endsWith('.png') || EXCLUDE.has(file)) continue;
          const { bytes } = await convert(
            path.join(subSource, file),
            path.join(subTarget, file),
            group.size,
          );
          manifest[`${group.to}/${entry.name}/${file}`] = bytes;
          count += 1;
          totalBytes += bytes;
        }
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.png') || EXCLUDE.has(entry.name)) continue;

      const { bytes } = await convert(
        path.join(sourceDir, entry.name),
        path.join(targetDir, entry.name),
        group.size,
      );
      manifest[`${group.to}/${entry.name}`] = bytes;
      count += 1;
      totalBytes += bytes;
    }
  }

  await writeFile(
    path.join(OUT, 'manifest.json'),
    `${JSON.stringify(
      {
        generated: 'scripts/build-icons.mjs — do not edit by hand',
        source: 'assets-master/icons',
        files: Object.keys(manifest).sort(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Wrote ${count} icons, ${(totalBytes / 1024).toFixed(0)} KB total`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
