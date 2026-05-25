import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const DeleteTemplateService = async ({ id }: { id: string }): Promise<void> => {
  const rows = await surql(`SELECT id FROM templates:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_TEMPLATE_FOUND', 404);
  await restDelete('templates', Number(id));
};

export default DeleteTemplateService;
