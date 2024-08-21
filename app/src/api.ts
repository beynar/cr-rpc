import { createClient } from 'flarepc/client';
import type { API, Server, Servers } from 'example-worker/src/index';

export const api = createClient<Server>({
	endpoint: 'http://localhost:8080',
	onError: (error) => {
		console.log(error);
	}
});

export const publicApi = createClient<Servers, 'public'>({
	endpoint: 'http://localhost:8080',
	server: 'public',
	onError: (error) => {
		console.log(error);
	}
});

// export const adminApi = createClient<AdminServer>({
// 	endpoint: 'http://localhost:8080/admin',
// 	onError: (error) => {
// 		console.log(error);
// 	}
// };

export { type API };
