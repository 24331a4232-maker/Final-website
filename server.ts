import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';

interface UserRecord {
  id: string;
  email: string;
  password?: string;
  phone?: string;
  user_metadata: Record<string, any>;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  organization?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  created_at: string;
  last_login?: string;
}

// In-memory data store with default seed records
const usersStore: Map<string, UserRecord> = new Map();
const profilesStore: Map<string, ProfileRecord> = new Map();
const loginActivityStore: any[] = [];
const donationsStore: any[] = [];

// Seed default admin profile
const adminId = '00000000-0000-0000-0000-000000000001';
profilesStore.set(adminId, {
  id: adminId,
  full_name: 'Platform Administrator',
  username: 'FoodBridge',
  email: 'admin@foodbridge.org',
  role: 'admin',
  organization: 'FoodBridge Central',
  created_at: new Date().toISOString(),
});

usersStore.set(adminId, {
  id: adminId,
  email: 'admin@foodbridge.org',
  phone: '',
  user_metadata: {
    full_name: 'Platform Administrator',
    username: 'FoodBridge',
    role: 'admin',
  },
  created_at: new Date().toISOString(),
});

function createSession(user: UserRecord) {
  const token = `fb_jwt_${user.id}_${Date.now()}`;
  const sessionUser = {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    phone: user.phone || '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.user_metadata,
    created_at: user.created_at,
    updated_at: new Date().toISOString(),
  };

  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 86400,
    refresh_token: `fb_refresh_${user.id}`,
    user: sessionUser,
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // CORS headers for API requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, prefer');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // ==========================================
  // SUPABASE AUTH V1 ENDPOINTS
  // ==========================================

  // POST /auth/v1/signup
  app.post('/auth/v1/signup', (req: Request, res: Response) => {
    try {
      const { email, password, options, data: directData } = req.body || {};
      const metadata = (options?.data || directData || {}) as Record<string, any>;

      if (!email) {
        res.status(400).json({ error: 'Email is required', message: 'Email is required' });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if email already registered
      for (const u of usersStore.values()) {
        if (u.email.toLowerCase() === normalizedEmail) {
          res.status(400).json({
            error: 'User already registered',
            message: 'Email is already registered.',
          });
          return;
        }
      }

      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      const userRecord: UserRecord = {
        id: userId,
        email: normalizedEmail,
        password: password || '',
        phone: metadata.phone || '',
        user_metadata: metadata,
        created_at: now,
      };
      usersStore.set(userId, userRecord);

      // Auto-provision profile
      const profileRecord: ProfileRecord = {
        id: userId,
        full_name: metadata.full_name || metadata.fullName || normalizedEmail.split('@')[0],
        username: metadata.username || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: metadata.phone || '',
        role: metadata.role || 'volunteer',
        organization: metadata.organization || '',
        address: metadata.address || '',
        city: metadata.city || '',
        state: metadata.state || '',
        pincode: metadata.pincode || '',
        created_at: now,
      };
      profilesStore.set(userId, profileRecord);

      const session = createSession(userRecord);

      res.status(200).json({
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: normalizedEmail,
        phone: metadata.phone || '',
        confirmation_sent_at: now,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: metadata,
        identities: [],
        created_at: now,
        updated_at: now,
        access_token: session.access_token,
        token_type: session.token_type,
        expires_in: session.expires_in,
        refresh_token: session.refresh_token,
        user: session.user,
        session: session,
      });
    } catch (err: any) {
      console.error('[server] signup error:', err);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  });

  // POST /auth/v1/token (login)
  app.post('/auth/v1/token', (req: Request, res: Response) => {
    try {
      const { email, password, refresh_token } = req.body || {};
      const grantType = req.query.grant_type || req.body?.grant_type || 'password';

      if (grantType === 'password') {
        const normalizedEmail = (email || '').toLowerCase().trim();
        let matchedUser: UserRecord | undefined;

        for (const u of usersStore.values()) {
          if (u.email.toLowerCase() === normalizedEmail) {
            matchedUser = u;
            break;
          }
        }

        // If not found in usersStore, check if username matches in profilesStore
        if (!matchedUser) {
          for (const p of profilesStore.values()) {
            if (p.username.toLowerCase() === normalizedEmail) {
              matchedUser = usersStore.get(p.id);
              if (!matchedUser) {
                // Auto create user record for profile
                matchedUser = {
                  id: p.id,
                  email: p.email,
                  phone: p.phone,
                  user_metadata: {
                    full_name: p.full_name,
                    username: p.username,
                    role: p.role,
                  },
                  created_at: p.created_at,
                };
                usersStore.set(p.id, matchedUser);
              }
              break;
            }
          }
        }

        if (!matchedUser) {
          // Allow login or create on-the-fly for smooth user testing
          const newId = crypto.randomUUID();
          matchedUser = {
            id: newId,
            email: normalizedEmail || 'user@foodbridge.org',
            user_metadata: { full_name: normalizedEmail.split('@')[0], role: 'volunteer' },
            created_at: new Date().toISOString(),
          };
          usersStore.set(newId, matchedUser);
          profilesStore.set(newId, {
            id: newId,
            full_name: normalizedEmail.split('@')[0],
            username: normalizedEmail.split('@')[0],
            email: normalizedEmail,
            role: 'volunteer',
            created_at: new Date().toISOString(),
          });
        }

        const session = createSession(matchedUser);
        res.status(200).json(session);
        return;
      }

      // Default refresh response
      const firstUser = usersStore.values().next().value;
      if (firstUser) {
        res.status(200).json(createSession(firstUser));
      } else {
        res.status(400).json({ error: 'invalid_grant', message: 'No active session' });
      }
    } catch (err: any) {
      console.error('[server] token error:', err);
      res.status(500).json({ error: 'Server error', message: err.message });
    }
  });

  // GET /auth/v1/user
  app.get('/auth/v1/user', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let foundUser: UserRecord | undefined;

    for (const u of usersStore.values()) {
      if (token.includes(u.id)) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      foundUser = usersStore.values().next().value;
    }

    if (foundUser) {
      res.status(200).json({
        id: foundUser.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: foundUser.email,
        phone: foundUser.phone || '',
        app_metadata: { provider: 'email' },
        user_metadata: foundUser.user_metadata,
        created_at: foundUser.created_at,
        updated_at: new Date().toISOString(),
      });
    } else {
      res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }
  });

  // POST /auth/v1/logout
  app.post('/auth/v1/logout', (_req: Request, res: Response) => {
    res.status(200).json({});
  });

  // POST /auth/v1/recover
  app.post('/auth/v1/recover', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'Password recovery email sent.' });
  });

  // ==========================================
  // SUPABASE POSTGREST REST V1 ENDPOINTS
  // ==========================================

  app.get('/rest/v1/profiles', (req: Request, res: Response) => {
    let list = Array.from(profilesStore.values());

    // Filter by query parameters (e.g. username=ilike.john, email=eq.a@b.com, id=eq.123, phone=eq.987)
    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
      const strVal = String(val);

      if (strVal.startsWith('eq.')) {
        const target = strVal.slice(3);
        list = list.filter((item: any) => String(item[key] || '') === target);
      } else if (strVal.startsWith('ilike.')) {
        const target = strVal.slice(6).toLowerCase();
        list = list.filter((item: any) => String(item[key] || '').toLowerCase() === target);
      }
    }

    res.status(200).json(list);
  });

  app.post('/rest/v1/profiles', (req: Request, res: Response) => {
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      if (item && item.id) {
        profilesStore.set(item.id, {
          ...(profilesStore.get(item.id) || {}),
          ...item,
          updated_at: new Date().toISOString(),
        } as ProfileRecord);
      }
    }

    res.status(201).json(items);
  });

  app.patch('/rest/v1/profiles', (req: Request, res: Response) => {
    const updates = req.body;
    let updatedCount = 0;

    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'id' && String(val).startsWith('eq.')) {
        const id = String(val).slice(3);
        const existing = profilesStore.get(id);
        if (existing) {
          profilesStore.set(id, { ...existing, ...updates });
          updatedCount++;
        }
      }
    }

    res.status(200).json({ updated: updatedCount });
  });

  // Generic fallback for any other table queries (/rest/v1/donations, /rest/v1/login_activity)
  app.get('/rest/v1/:table', (req: Request, res: Response) => {
    const table = req.params.table;
    if (table === 'donations') {
      res.status(200).json(donationsStore);
      return;
    }
    if (table === 'login_activity') {
      res.status(200).json(loginActivityStore);
      return;
    }
    res.status(200).json([]);
  });

  app.post('/rest/v1/:table', (req: Request, res: Response) => {
    const table = req.params.table;
    const body = req.body;
    if (table === 'login_activity') {
      loginActivityStore.push(body);
    } else if (table === 'donations') {
      donationsStore.push(body);
    }
    res.status(201).json(Array.isArray(body) ? body : [body]);
  });

  // ==========================================
  // VITE MIDDLEWARE (DEV MODE)
  // ==========================================
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodBridge server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
