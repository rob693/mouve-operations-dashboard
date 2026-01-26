// Vercel Edge Middleware — password protection for MOUVE Operations Dashboard

export const config = {
  matcher: '/((?!favicon.ico|_vercel).*)',
};

export default function middleware(request) {
  var authHeader = request.headers.get('authorization');

  if (authHeader) {
    var encoded = authHeader.split(' ')[1] || '';
    var decoded = atob(encoded);
    var parts = decoded.split(':');
    var password = parts.slice(1).join(':');

    if (password === process.env.OPS_DASHBOARD_PASSWORD) {
      return undefined; // Allow request through to static files
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MOUVE Operations"',
    },
  });
}
