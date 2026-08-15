import { Env } from './types';

export interface AuthUser {
  id: string;
  email: string;
}

export async function requireAuth(request: Request, env: Env): Promise<AuthUser> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);

  // Resolve secrets from Secrets Store
  const [supabaseUrl, supabaseAnonKey] = await Promise.all([
    Promise.resolve(env.SUPABASE_URL),   // plain var — no .get()
    env.SUPABASE_ANON_KEY.get(),
  ]);

  // Verify with Supabase
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!res.ok) {
    throw new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await res.json() as { id: string; email: string };

  // Upsert user in D1
  await env.DB.prepare(`
    INSERT INTO users (id, email) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, updated_at = datetime('now')
  `).bind(user.id, user.email).run();

  return { id: user.id, email: user.email };
}