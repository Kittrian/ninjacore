import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const DeleteAlternateLettersService = async ({ id }: { id: string }): Promise<void> => {
  const rows = await surql(`SELECT id FROM alternate_letters:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_ALTERNATE_LETTERS_FOUND', 404);
  await restDelete('alternate_letters', Number(id));
};

export default DeleteAlternateLettersService;
