import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const DeleteUserService = async (
  id: string | number,
  _tenantId: string | number,
  _userIdRequest: string | number
): Promise<void> => {
  const rows = await surql(`SELECT id FROM api_users:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_USER_FOUND', 404);
  await restDelete('api_users', Number(id));
};

export default DeleteUserService;
