import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('auth-role')?.value;
  const { pathname } = request.nextUrl;

  // Let API and static files pass through
  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/brand') ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const publicAuthPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicAuth = publicAuthPaths.includes(pathname) || pathname === '/auth';

  // Pending User: /pending home; also allow read-only /profile
  if (role === 'Pending User') {
    if (pathname !== '/pending' && pathname !== '/profile') {
      return NextResponse.redirect(new URL('/pending', request.url));
    }
    return NextResponse.next();
  }

  // If not logged in and not on an auth page, redirect to login
  if (!role && !isPublicAuth) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If already logged in, skip auth pages
  if (role && isPublicAuth) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If approved user tries to access /pending, redirect home
  if (role && role !== 'Pending User' && pathname === '/pending') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Admin section: Only Admin can access
  if (pathname.startsWith('/admin') && role !== 'Admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // My Requests: Admin should not access
  if (pathname.startsWith('/my-requests') && role === 'Admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Request Management: Only Admin and HR can access
  if (pathname.startsWith('/request-management') && role !== 'HR' && role !== 'Admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Team → TL: Only Admin and HR
  if (pathname.startsWith('/team-tl') && role !== 'HR' && role !== 'Admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Team Data: Team Leader only
  if (pathname.startsWith('/team-data') && role !== 'Team Leader') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
