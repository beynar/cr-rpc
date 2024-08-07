import { createClient } from 'flarepc/client';
import type { Server, API } from 'example-worker/src/index';

export const api = createClient<Server>({
	endpoint: 'http://localhost:8080'
});

declare module 'flarepc' {
	interface Register {
		Participant: {
			id: string;
			name: string;
		};
	}
}

export { type API };
