import { surql, restPut, sEsc, normalizeRecord } from '../../lib/surreal';

export interface RequestTemplate {
  name: string;
  file_name: string;
  file_html: string;
  tu: object;
  ex: object;
  eq: object;
  paraghraphs: object[];
  id?: number;
}

const CreateTemplateService = async ({ name, file_name, file_html, tu, ex, eq, paraghraphs, id }: RequestTemplate): Promise<any> => {
  const now = new Date().toISOString();
  const lastRows = await surql(`SELECT id FROM templates ORDER BY id DESC LIMIT 1`);
  const newId = id ?? ((normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1);

  await restPut('templates', newId, {
    name, file_name, file_html,
    tu_json: JSON.stringify(tu ?? {}),
    ex_json: JSON.stringify(ex ?? {}),
    eq_json: JSON.stringify(eq ?? {}),
    paragraphs_json: JSON.stringify(paraghraphs ?? []),
    created_at: now, updated_at: now,
  });
  return { id: newId, name, file_name, file_html, tu, ex, eq, paraghraphs };
};

export default CreateTemplateService;
