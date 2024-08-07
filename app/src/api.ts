import { createClient } from 'flarepc/client';
import type { Server, API, OUT } from 'example-worker/src/index';
import type {
	Get,
	Handler,
	InferOutPutAtPath,
	Router,
	RouterPaths,
	Schema,
	SchemaOutput
} from 'flarepc';

export const api = createClient<Server>({
	endpoint: 'http://localhost:8080'
});

export { type API };
