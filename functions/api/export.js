import { entriesToExcelHtml, exportFilename } from '../../src/export.js';
import { authErrorResponse, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    let query = `
      SELECT e.*, u.province_label
      FROM entries e
      LEFT JOIN users u ON u.province_code = e.province_code
    `;
    let stmt;
    if (user.role === 'admin') {
      query += ` ORDER BY e.round, e.province_code, e.plot, e.bunch`;
      stmt = env.DB.prepare(query);
    } else {
      query += ` WHERE e.province_code = ? ORDER BY e.round, e.plot, e.bunch`;
      stmt = env.DB.prepare(query).bind(user.province_code);
    }
    const rows = await stmt.all();
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
