import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Without this, Next walks up past the repo and finds the parent directory's
  // lockfile, which is not ours.
  turbopack: { root: __dirname },

  /*
   * No dev indicator.
   *
   * The small N badge in the corner is Next's build-activity overlay. It never
   * ships — production strips it — but this world gets shown and judged from a
   * laptop as often as from a URL, and a framework's logo sitting on the water
   * is the one thing in frame that belongs to somebody else.
   */
  devIndicators: false,
}

export default nextConfig
