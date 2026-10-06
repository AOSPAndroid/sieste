import {getChatGPTUser} from '../../../chatgpt-auth';
import {privateJson} from '../../../../db/storage';
import {GarminError, garminSameOrigin, beginGarminAuthorization} from '../../../../db/garmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!garminSameOrigin(request)) return privateJson({error: 'Cross-site request rejected.'}, 403);
  const user = await getChatGPTUser();
  if (!user) return privateJson({error: 'Sign in to sieste first.'}, 401);
  try {
    const {url, state} = await beginGarminAuthorization(user.userId, new URL(request.url).origin);
    const response = privateJson({url});
    response.headers.set('Set-Cookie', `sieste_garmin_state=${state}; Path=/api/garmin; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    return response;
  } catch (error) {
    return privateJson({error: error instanceof GarminError ? error.message : 'Could not start Garmin sign-in. Please retry.'}, error instanceof GarminError ? error.status : 503);
  }
}
