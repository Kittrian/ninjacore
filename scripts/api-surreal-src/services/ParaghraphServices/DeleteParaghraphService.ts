import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const DeleteParaghraphService = async ({ id }: { id: string }): Promise<void> => {
  const rows = await surql(`SELECT id FROM paragraphs:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_PARAGHRAPH_FOUND', 404);
  await restDelete('paragraphs', Number(id));
};

export default DeleteParaghraphService;
