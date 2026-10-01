import { getChatGPTUser } from "../../chatgpt-auth";
import { connection, privateJson, storage } from "../../../db/storage";
import { corosConnection } from "../../../db/coros";
import { deviceCacheScope } from "../../../db/device-cache-scope";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return privateJson({
      signedIn: false,
      connected: false,
      corosConnected: false,
      cacheScope: null,
    });
  try {
    const [training, coros] = await Promise.all([
      connection(user.userId),
      corosConnection(user.userId),
    ]);
    const connected = !!training || !!coros;
    return privateJson({
      signedIn: true,
      userId: user.userId,
      name: user.displayName,
      connected,
      corosConnected: !!coros,
      cacheScope: connected
        ? await deviceCacheScope(user.userId, training, coros, storage().key)
        : null,
    });
  } catch {
    return privateJson(
      { error: "Your account could not be checked. Please retry." },
      503,
    );
  }
}
