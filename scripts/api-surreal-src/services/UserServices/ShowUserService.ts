import { surql, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const ShowUserService = async (id: string | number): Promise<any> => {
  const rows = await surql(`SELECT * FROM api_users:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_USER_FOUND', 404);
  const u = normalizeRecord(rows[0]);
  return { id: u.id, name: u.name, email: u.email, profile: u.profile };
};

export default ShowUserService;
