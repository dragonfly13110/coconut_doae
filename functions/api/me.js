import { authErrorResponse, json, methodNotAllowed, requireUser } from '../../src/pages-api.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const user = await requireUser(request, env);
    return json({ user });
  } catch (error) {
    return authErrorResponse(error) || json({ error: error.message }, { status: 500 });
  }
}
