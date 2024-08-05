import { it, expect } from 'vitest';
import worker, { AppRouter, Server } from '../src/index';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createClient } from '../src/lib/client';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const api = () =>
	createClient<Server>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: async (_endpoint: any, body: any) => {
			const request = new IncomingRequest(_endpoint, body);
			const ctx = createExecutionContext();
			await waitOnExecutionContext(ctx);
			return worker.fetch(request, env, ctx);
		},
	});

it('Send an object and receive a response', async () => {
	const result = await api().TestDurable('objectId').test.test.test({
		name: 'world',
	});
	// const result_ws = await api().TestDurable('objectId').connect({
	// 	messages: {},
	// });
	// const result2 = await api().test.boolean({
	// 	boolean: true,
	// });

	expect(result).toEqual({
		hello: 'world',
	});
});
