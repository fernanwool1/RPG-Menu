import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits in the bottom-right corner, exactly where the
  // mobile tab bar and sheet actions live. Dev-only, but it makes visual
  // checks at phone widths unreadable.
  devIndicators: false,
  // Pin the workspace root: a lockfile higher up the tree would otherwise be
  // inferred as the root and drag unrelated files into tracing.
  outputFileTracingRoot: here,
};

export default nextConfig;
