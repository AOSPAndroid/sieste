import {getChatGPTUser} from '../../../chatgpt-auth';
import {GARMIN_ORIGIN, GarminError, garminConfigured, consumeGarminAuthorization, completeGarminAuthorization} from '../../../../db/garmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const finish = (status: string) => new Response(null, {status: 303, headers: {
    Location: '/?garmin=' + status,
    'Cache-Control': 'no-store, private',
    'Referrer-Policy': 'no-referrer',
    'Set-Cookie': 'sieste_garmin_state=; Path=/api/garmin; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  }});
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith('sieste_garmin_state='))?.slice('sieste_garmin_state='.length);
  if (url.origin !== GARMIN_ORIGIN || !state || state !== cookie) return finish('expired');
  const user = await getChatGPTUser();
  if (!user) return finish('signin');
  try {
    const pending = await consumeGarminAuthorization(user.userId, state, url.origin);
    if (!pending) return finish('expired');
    if (!garminConfigured()) return finish('unconfigured');
    const code = url.searchParams.get('code');
    if (url.searchParams.has('error') || !code) return finish('cancelled');
    await completeGarminAuthorization(user.userId, pending, code);
    return finish('connected');
  } catch (error) {
    return finish(error instanceof GarminError && error.callbackStatus ? error.callbackStatus : 'failed');
  }
}
