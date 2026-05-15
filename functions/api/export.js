import { entriesToExcelHtml, exportFilename } from '../../src/export.js';
import { authErrorResponse, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    await requireUser(request, env);
    const rows = await env.DB.prepare(`
      SELECT e.*, u.province_label
      FROM entries e
      LEFT JOIN users u ON u.province_code = e.province_code
      ORDER BY e.round, e.province_code, e.plot, e.bunch
    `).all();
    const body = entriesToExcelHtml(rows.results || []);

    return new Response(body, {
      headers: {
        'content-type': 'application/vnd.ms-excel; charset=utf-8',
        'content-disposition': `attachment; filename="${exportFilename()}"`,
      },
    });
  } catch (error) {
    return authErrorResponse(error) || new Response(error.message, { status: 500 });
  }
}
