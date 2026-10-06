import {getChatGPTUser} from '../../chatgpt-auth';
import {privateJson} from '../../../db/storage';
import {GarminError, garminMetadata, garminSameOrigin, disconnectGarmin} from '../../../db/garmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return privateJson({error: 'Sign in to sieste first.'}, 401);
  try {
    return privateJson(await garminMetadata(user.userId));
  } catch {
    return privateJson({error: 'Garmin connection status is unavailable. Please retry.'}, 503);
  }
}

export async function DELETE(request: Request) {
  if (!garminSameOrigin(request)) return privateJson({error: 'Cross-site request rejected.'}, 403);
  const user = await getChatGPTUser();
  if (!user) return privateJson({error: 'Sign in to sieste first.'}, 401);
  try {
    await disconnectGarmin(user.userId);
    return privateJson({disconnected: true, dataSyncReady: false});
  } catch (error) {
    return privateJson({error: error instanceof GarminError ? error.message : 'Could not disconnect Garmin. Please retry.'}, error instanceof GarminError ? error.status : 503);
  }
}
