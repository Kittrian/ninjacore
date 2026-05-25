import { surql, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request {
  userId: string | number;
  configs: Record<string, any>;
}

const UpdateUserConfigsService = async ({ userId, configs }: Request): Promise<any> => {
  const rows = await surql(`SELECT * FROM api_users:${Number(userId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_USER_FOUND', 404);
  const updated = await restPatch('api_users', Number(userId), {
    ...configs,
    updated_at: new Date().toISOString(),
  });
  return normalizeRecord(updated || rows[0]);
};

export default UpdateUserConfigsService;
