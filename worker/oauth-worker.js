// Switch OAuth Token Exchange Worker
// Deploy to Cloudflare Workers. Handles only the OAuth code → token exchange.
// Environment variables needed: CLIENT_ID, CLIENT_SECRET, ALLOWED_ORIGIN

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/oauth/token' && request.method === 'POST') {
      try {
        const { code, redirect_uri } = await request.json();

        if (!code || !redirect_uri) {
          return Response.json(
            { error: 'Missing code or redirect_uri' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Exchange code for token with Cloudflare
        const tokenRes = await fetch('https://dash.cloudflare.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
            code,
            redirect_uri,
          }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
          return Response.json(
            { error: tokenData.error_description || 'Token exchange failed' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Return only the access token (don't expose refresh token to client)
        return Response.json(
          { access_token: tokenData.access_token },
          { headers: corsHeaders }
        );

      } catch (err) {
        return Response.json(
          { error: 'Internal error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  },
};
