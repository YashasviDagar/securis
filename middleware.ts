import { NextResponse, type NextRequest } from "next/server";

/**
 * Securis - Edge middleware
 *
 * Purpose: expose the current request path to server components via an
 * `x-pathname` request header. The authenticated (soc) layout uses it to
 * enforce per-route permissions *before* it starts streaming the response, so
 * an unauthorized navigation results in a proper HTTP 307 redirect instead of
 * a streamed client-side redirect.
 *
 * This middleware performs NO authorization itself and never touches the
 * database: it only forwards the path. All access decisions remain in the
 * server-side session/permission layer.
 *
 * Connection: app/(soc)/layout.tsx reads the `x-pathname` header.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  /**
   * Run on application routes only. Static assets and image optimisation are
   * excluded so the middleware stays cheap.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
