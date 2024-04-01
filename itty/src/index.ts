/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

declare global {
	interface Env {
		// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
		MY_KV_NAMESPACE: KVNamespace;
		//
		// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
		MY_DURABLE_OBJECT: DurableObjectNamespace;
		//
		// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
		MY_BUCKET: R2Bucket;
		//
		// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
		MY_SERVICE: Fetcher;
		//
		// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
		MY_QUEUE: Queue;

		VECTORIZE: VectorizeIndex;
	}
}
import { AutoRouter, error } from 'itty-router';

const router = AutoRouter();

router.post('/test', async (request) => {
	const input = await request.json();
	if ('name' in input) {
		return {
			hello: input.name,
			colo: request.cf?.colo,
		};
	} else {
		error(400);
	}
});
router.get('/test', (request) => {
	return {
		hello: 'world',
		colo: request.cf?.colo,
	};
});

router.all('*', () => error(404));

export default { fetch: router.fetch };
