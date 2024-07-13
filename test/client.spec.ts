import { it, expect } from 'vitest';
import worker, { AppRouter } from '../src/index';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createClient } from '../src/lib/client';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const f = async (_endpoint: any, body: any) => {
	const request = new IncomingRequest(_endpoint, body);
	const ctx = createExecutionContext();
	await waitOnExecutionContext(ctx);
	return worker.fetch(request, env, ctx);
};

const api = createClient<AppRouter>({
	endpoint: 'https://example.com',
	// @ts-ignore
	fetch: f,
});

// it('Send an object and receive a response', async () => {
// 	const result = await api.test.object({
// 		name: 'world',
// 	});

// 	expect(result).toEqual({
// 		hello: 'world',
// 	});
// });

// it('Send a string and receive a response', async () => {
// 	const result = await api.test.string('world');
// 	expect(result).toEqual({
// 		hello: 'world',
// 	});
// });

// it('Send a date and receive a response', async () => {
// 	const date = new Date();
// 	const result = await api.test.date(date);
// 	console.log(result);
// 	expect(result).toEqual({
// 		hello: date,
// 	});
// });

// it('Send a number and receive a response', async () => {
// 	const result = await api.test.number(123);
// 	expect(result).toEqual({
// 		hello: 123,
// 	});
// });

// it('Send a boolean and receive a response', async () => {
// 	const result = await api.test.boolean({ boolean: true });
// 	expect(result).toEqual({
// 		hello: {
// 			boolean: true,
// 		},
// 	});
// });

// it('Send a null and receive a response', async () => {
// 	const result = await api.test.null(null);

// 	expect(result).toEqual({
// 		hello: null,
// 	});
// });

// // it('Send an undefined and receive a response', async () => {
// // 	const result = await api.test.undefined();
// // 	expect(result).toEqual({
// // 		hello: undefined,
// // 	});
// // });

// it('Send a map and receive a response', async () => {
// 	const map = new Map([
// 		['hello', 'world'],
// 		['world', 'hello'],
// 	]);
// 	const result = await api.test.map(map);
// 	expect(result).toEqual({
// 		hello: map,
// 	});
// });
// it('Send a set and receive a response', async () => {
// 	const set = new Set(['hello', 'world']);
// 	const result = await api.test.set(set);
// 	expect(result).toEqual({
// 		hello: set,
// 	});
// });

// it('Send a complex object and receive a response', async () => {
// 	const input = {
// 		string: 'world',
// 		date: new Date(),
// 		number: 1,
// 		undefined: undefined,
// 		null: null,
// 		boolean: true,
// 		object: {
// 			string: 'world',
// 			date: new Date(),
// 			number: 1,
// 			undefined: undefined,
// 			null: null,
// 			map: new Map([
// 				['hello', 'world'],
// 				['world', 'hello'],
// 			]),
// 			file: new File(['hello'], 'hello.txt'),
// 			boolean: true,
// 		},
// 	};
// 	const result = await api.test.complex(input);

// 	expect(result).toEqual({
// 		hello: input,
// 	});
// });

it('Send a request to a path parametrized endpoint and receive a response', async () => {
	// const result = await api.test.update({
	// 	name: 'world',
	// });

	const result = await api.parametrized.id('test').update({
		name: 'world',
	});

	console.log('result', { result });

	expect({
		name: 'world',
	}).toEqual({
		name: 'world',
	});
});
