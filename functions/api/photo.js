import { authErrorResponse, json, methodNotAllowed, readJson, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return getPhotos(request, env, user);
    if (request.method === 'POST') return uploadPhoto(request, env, user);
    if (request.method === 'DELETE') return deletePhoto(request, env, user);
    return methodNotAllowed();
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 400 });
  }
}

async function getPhotos(request, env, user) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const countOnly = url.searchParams.get('count_only') === '1';

  // 1. Single photo full fetch (including base64 image data)
  if (id) {
    const photo = await env.DB.prepare(`
      SELECT p.*, u.province_label AS uploaded_by_label
      FROM entry_photos p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.id = ?
    `).bind(Number(id)).first();

    if (!photo) return json({ error: 'ไม่พบรูปภาพที่ระบุ' }, { status: 404 });
    if (user.role !== 'admin' && photo.province_code !== user.province_code) {
      return json({ error: 'ไม่มีสิทธิ์เข้าถึงรูปภาพของจังหวัดอื่น' }, { status: 403 });
    }
    return json({ photo });
  }

  // 2. Count only mode (for rendering indicators in grid/matrix)
  if (countOnly) {
    const round = url.searchParams.get('round');
    let query = `
      SELECT round, province_code, plot, bunch, COUNT(*) as photo_count
      FROM entry_photos
    `;
    const conditions = [];
    const params = [];

    if (user.role !== 'admin') {
      conditions.push('province_code = ?');
      params.push(user.province_code);
    } else if (url.searchParams.get('province_code')) {
      conditions.push('province_code = ?');
      params.push(url.searchParams.get('province_code'));
    }

    if (round) {
      conditions.push('round = ?');
      params.push(Number(round));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY round, province_code, plot, bunch';
    const rows = await env.DB.prepare(query).bind(...params).all();
    return json({ counts: rows.results || [] });
  }

  // 3. List photos for a specific round, province, plot, bunch
  const round = Number(url.searchParams.get('round'));
  const province = user.role === 'admin' ? url.searchParams.get('province_code') : user.province_code;
  const plot = Number(url.searchParams.get('plot'));
  const bunch = Number(url.searchParams.get('bunch'));

  if (!round || !province || !plot || !bunch) {
    return json({ error: 'ระบุตำแหน่งรอบ จังหวัด แปลง และทะลายไม่ครบถ้วน' }, { status: 400 });
  }

  const rows = await env.DB.prepare(`
    SELECT p.id, p.round, p.province_code, p.plot, p.bunch, p.caption, p.photo_data, p.size_bytes, p.uploaded_at,
           u.province_label AS uploaded_by_label
    FROM entry_photos p
    LEFT JOIN users u ON p.uploaded_by = u.id
    WHERE p.round = ? AND p.province_code = ? AND p.plot = ? AND p.bunch = ?
    ORDER BY p.uploaded_at DESC
  `).bind(round, province, plot, bunch).all();

  return json({ photos: rows.results || [] });
}

async function uploadPhoto(request, env, user) {
  const body = await readJson(request);
  const round = Number(body.round);
  const province_code = user.role === 'admin' ? String(body.province_code || user.province_code) : user.province_code;
  const plot = Number(body.plot);
  const bunch = Number(body.bunch);
  const caption = String(body.caption || '').trim().slice(0, 200);
  const photo_data = String(body.photo_data || '').trim();

  if (!round || !province_code || !plot || !bunch) {
    return json({ error: 'ข้อมูลตำแหน่งแปลงไม่ครบถ้วน' }, { status: 400 });
  }

  if (!photo_data || !photo_data.startsWith('data:image/')) {
    return json({ error: 'รูปแบบไฟล์รูปภาพไม่ถูกต้อง ต้องเป็น Image Data URI' }, { status: 400 });
  }

  // Max 1.5MB base64 string check (safety guard against raw uncompressed photos)
  if (photo_data.length > 1500000) {
    return json({ error: 'ขนาดรูปภาพใหญ่เกินไป (ต้องไม่เกิน 1 MB หลังจากบีบอัด)' }, { status: 400 });
  }

  const size_bytes = Math.round((photo_data.length * 3) / 4);

  const result = await env.DB.prepare(`
    INSERT INTO entry_photos (
      round, province_code, plot, bunch, caption, photo_data, size_bytes, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    round,
    province_code,
    plot,
    bunch,
    caption,
    photo_data,
    size_bytes,
    user.id
  ).run();

  return json({
    ok: true,
    id: result.meta?.last_row_id || null,
    size_bytes,
    caption,
  });
}

async function deletePhoto(request, env, user) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));

  if (!id) return json({ error: 'ต้องระบุ ID ของรูปภาพ' }, { status: 400 });

  const photo = await env.DB.prepare(`
    SELECT id, province_code, round, plot, bunch
    FROM entry_photos
    WHERE id = ?
  `).bind(id).first();

  if (!photo) return json({ error: 'ไม่พบรูปภาพที่ต้องการลบ' }, { status: 404 });

  if (user.role !== 'admin' && photo.province_code !== user.province_code) {
    return json({ error: 'ไม่มีสิทธิ์ลบรูปภาพของจังหวัดอื่น' }, { status: 403 });
  }

  await env.DB.prepare('DELETE FROM entry_photos WHERE id = ?').bind(id).run();

  return json({ ok: true, deleted_id: id });
}
