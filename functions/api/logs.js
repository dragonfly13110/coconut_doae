import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../src/pages-api.js';
import { ensureSystemAuditDb } from '../../src/user-accounts.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    await ensureSystemAuditDb(env.DB);

    // Only Central DOAE and Admin have permission to view system audit logs
    const isCentralOrAdmin = ['admin', 'central'].includes(user.role) ||
      user.username === 'admin' ||
      user.username === 'doae_hq' ||
      user.username === 'doae';

    if (!isCentralOrAdmin) {
      return json({ error: 'สงวนสิทธิ์การเข้าถึงเฉพาะกรมส่งเสริมการเกษตร (ส่วนกลาง) และผู้ดูแลระบบเท่านั้น' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const action = url.searchParams.get('action');
    const targetType = url.searchParams.get('target_type');
    const search = url.searchParams.get('search');

    let query = 'SELECT * FROM system_audit_logs';
    let countQuery = 'SELECT COUNT(*) as total FROM system_audit_logs';
    const conditions = [];
    const bindings = [];

    if (action && action !== 'all') {
      conditions.push('action = ?');
      bindings.push(action);
    }
    if (targetType && targetType !== 'all') {
      conditions.push('target_type = ?');
      bindings.push(targetType);
    }
    if (search && search.trim()) {
      conditions.push('(username LIKE ? OR user_label LIKE ? OR target_label LIKE ? OR district_name LIKE ? OR summary LIKE ?)');
      const term = `%${search.trim()}%`;
      bindings.push(term, term, term, term, term);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';

    const countStmt = env.DB.prepare(countQuery);
    const totalRow = bindings.length > 0
      ? await countStmt.bind(...bindings).first()
      : await countStmt.first();
    const total = totalRow?.total || 0;

    const stmt = env.DB.prepare(query);
    const queryBindings = [...bindings, limit, offset];
    const { results: logs } = await stmt.bind(...queryBindings).all();

    return json({
      logs: logs || [],
      total,
      limit,
      offset,
    });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 500 });
  }
}

