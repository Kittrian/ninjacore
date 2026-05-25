import * as Yup from 'yup';
import { hash } from 'bcryptjs';
import { surql, sEsc, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request {
  email: string;
  password: string;
  name: string;
  tenantId?: string | number;
  profile?: 'user' | 'admin';
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const CreateUserService = async ({
  email, password, name, tenantId, profile = 'user'
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string().email().required().test(
      'Check-email', 'An user with this email already exists.',
      async (value) => {
        const rows = await surql(`SELECT id FROM api_users WHERE email = "${sEsc(value!)}" LIMIT 1`);
        return rows.length === 0;
      }
    ),
    password: Yup.string().required().min(5),
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const passwordHash = await hash(password, 8);
  const now = new Date().toISOString();

  // Find next available ID
  const existing = await surql(`SELECT id FROM api_users ORDER BY id DESC LIMIT 1`);
  const lastId = existing.length > 0 ? (normalizeRecord(existing[0]).id + 1) : 1;

  // Use SurrealQL UPSERT with auto ID
  const rows = await surql(`
    CREATE api_users CONTENT {
      name: "${sEsc(name)}",
      email: "${sEsc(email)}",
      password_hash: "${sEsc(passwordHash)}",
      profile: "${sEsc(profile)}",
      token_version: 0,
      tenant_id: ${Number(tenantId) || 0},
      is_online: false,
      status: "offline",
      created_at: time::now(),
      updated_at: time::now()
    }
  `);

  const user = normalizeRecord(rows[0]);
  return { id: user.id, name: user.name, email: user.email, profile: user.profile };
};

export default CreateUserService;
