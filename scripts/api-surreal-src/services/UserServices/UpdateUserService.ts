import * as Yup from 'yup';
import { hash } from 'bcryptjs';
import { surql, sEsc, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile: 'user' | 'admin';
  queues?: any[];
}

interface Request {
  userData: UserData;
  userId: string | number;
  tenantId: string | number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({ userData, userId }: Request): Promise<Response | undefined> => {
  const rows = await surql(`SELECT * FROM api_users:${Number(userId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_USER_FOUND', 404);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
  });

  const { email, password, profile, name } = userData;

  try {
    await schema.validate({ email, password, profile, name });
  } catch (err: any) {
    throw new AppError(err?.message);
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (email) updates.email = email;
  if (profile) updates.profile = profile;
  if (name) updates.name = name;
  if (password) updates.password_hash = await hash(password, 8);

  const updated = await restPatch('api_users', Number(userId), updates);
  const user = normalizeRecord(updated || rows[0]);

  return {
    id: user.id,
    name: user.name ?? name,
    email: user.email ?? email,
    profile: user.profile ?? profile,
    queues: []
  } as any;
};

export default UpdateUserService;
