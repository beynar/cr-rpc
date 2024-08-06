import { createClient } from 'flarepc/client';
import type { Server } from 'example-worker/src/index';

export const api = createClient<Server>({
	endpoint: 'http://localhost:8080'
});
