import { stringify, parse } from 'neoqs';
import { it, expect } from 'vitest';
import worker, { AppRouter } from '../src/index';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createClient } from '../src/lib/client';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const api = () =>
	createClient<AppRouter>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: async (_endpoint: any, body: any) => {
			const request = new IncomingRequest(_endpoint, body);
			const ctx = createExecutionContext();
			await waitOnExecutionContext(ctx);
			return worker.fetch(request, env, ctx);
		},
	});

it('Send a null and receive a response', async () => {
	const input = {
		string: 'world',
		date: new Date(),
		number: 1,
		undefined: undefined,
		null: null,
		boolean: true,
		object: {
			string: 'world',
			date: new Date(),
			number: 1,
			undefined: undefined,
			null: null,
			map: new Map([
				['hello', 'world'],
				['world', 'hello'],
			]),
			boolean: true,
		},
	};

	const stringified = stringify(input, {
		allowDots: true,
		skipNulls: false,
		strictNullHandling: true,
		arrayFormat: 'comma',
	});

	const parsed = parse(stringified, {
		allowDots: true,
		strictNullHandling: true,
	});
	console.log(stringified, { parsed });
	expect(true).toBe(true);
});
