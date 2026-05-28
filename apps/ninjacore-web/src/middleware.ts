import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Cache static assets aggressively
  if (request.nextUrl.pathname.startsWith('/_next/static')) {
    response.headers.set(
      'cache-control',
      'public, max-age=31536000, immutable'
    );
  }

  // Cache API responses with validation
  if (request.nextUrl.pathname.startsWith('/api/proxy')) {
    response.headers.set('cache-control', 'private, max-age=30, must-revalidate');
  }

  // Security headers
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('x-xss-protection', '1; mode=block');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/image|favicon.ico).*)',
  ],
};
