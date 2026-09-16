import type { NextConfig } from 'next'

/**
 * Response headers.
 *
 * None of these are theoretical: each closes a specific thing someone can do to
 * a site that omits it.
 *
 * A Content-Security-Policy is deliberately NOT here. Doing it properly means
 * enumerating every inline style this world emits — three.js, the overlay's
 * computed styles, the keyframes injected by the sound toggle — and a CSP that
 * needs 'unsafe-inline' to function protects against almost nothing while
 * implying it protects against everything. Better honestly absent than
 * dishonestly present.
 */
const securityHeaders = [
  // No framing at all. A portfolio has no reason to be embedded, and refusing
  // means nobody can put an invisible copy of it under their own buttons.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },

  // Serve every file as the type it was declared, so an upload that claims to
  // be an image but contains script cannot be talked into executing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Send the origin to other sites, never the full path, and nothing at all
  // when leaving HTTPS.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // This world needs none of these. Denying them means a dependency that
  // someday asks for the camera is refused by the browser, not by trust.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },

  // HTTPS only, for two years, subdomains included.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  // The contact endpoint must never be cached by a proxy — a cached 200 would
  // make a later message look sent when nothing was sent.
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

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

  // Do not advertise the framework and its version in every response.
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // The contact endpoint, explicitly uncacheable.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },
}

export default nextConfig
