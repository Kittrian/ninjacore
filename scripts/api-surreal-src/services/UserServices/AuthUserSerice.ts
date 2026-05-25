import { compare } from 'bcryptjs';
import { surql, surqlOne, sEsc, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';
import { createAccessToken, createRefreshToken } from '../../helpers/CreateTokens';

interface Request {
  email: string;
  password: string;
}

interface Response {
  user: any;
  token: string;
  refreshToken: string;
  usuariosOnline?: any[];
}

const AuthUserService = async ({ email, password }: Request): Promise<Response> => {
  const rows = await surql(`SELECT * FROM api_users WHERE email = "${sEsc(email)}" LIMIT 1`);
  const raw = rows[0];
  if (!raw) throw new AppError('ERR_INVALID_CREDENTIALS', 401);

  const user = normalizeRecord(raw);

  const valid = await compare(password, user.password_hash);
  if (!valid) throw new AppError('ERR_INVALID_CREDENTIALS', 401);

  // Build user object matching the shape controllers expect
  const userObj = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    tokenVersion: user.token_version ?? 0,
    tenantId: user.tenant_id ?? 0,
    isOnline: true,
    status: 'online',
    lastLogin: new Date(),
    passwordHash: user.password_hash,
    checkPassword: async (pw: string) => compare(pw, user.password_hash),
  };

  const token = createAccessToken(userObj as any);
  const refreshToken = createRefreshToken(userObj as any);

  // Update online status
  await restPatch('api_users', user.id, {
    is_online: true,
    status: 'online',
    last_login: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Get all online users
  const onlineRows = await surql(
    `SELECT id, name, email, profile, is_online, status FROM api_users WHERE is_online = true`
  );
  const usuariosOnline = onlineRows.map(normalizeRecord).map((u: any) => ({
    id: u.id, name: u.name, email: u.email,
    profile: u.profile, isOnline: u.is_online, status: u.status,
  }));

  return { user: userObj, token, refreshToken, usuariosOnline };
};

export default AuthUserService;
