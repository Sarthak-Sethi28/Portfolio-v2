import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Without this, Next walks up past the repo and finds the parent directory's
  // lockfile, which is not ours.
  turbopack: { root: __dirname },
}

export default nextConfig
