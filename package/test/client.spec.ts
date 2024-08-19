// import { it, expect } from 'vitest';
// import worker, { AppRouter, Server } from '../src/index';
// import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
// import { createClient } from '../src/lib/client';
// import { object, string } from 'valibot';
// import { form } from '../src/lib';
// const longString = `Lorem ipsum dolor sit amet consectetur adipisicing elit. Praesentium reprehenderit quidem, autem explicabo, tenetur placeat odit blanditiis fuga ad nostrum animi, amet aperiam perferendis aliquam ducimus quaerat obcaecati exercitationem dolor!`;

// const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// const api = () =>
// 	createClient<Server>({
// 		endpoint: 'https://example.com',
// 		includeCredentials: false,
// 		// @ts-ignore
// 		fetch: async (_endpoint: any, body: any) => {
// 			const request = new IncomingRequest(_endpoint, body);
// 			const ctx = createExecutionContext();
// 			await waitOnExecutionContext(ctx);
// 			return worker.fetch(request, env, ctx);
// 		},
// 	});

// it('Send an object and receive a response', async () => {
// 	const result = await api().test.object({
// 		name: 'world',
// 	});

// 	expect(result).toEqual({
// 		hello: 'world',
// 	});
// });

// it('Send a string and receive a response', async () => {
// 	const result = await api().test.string('world');
// 	expect(result).toEqual({
// 		hello: 'world',
// 	});
// });

// it('Send a date and receive a response', async () => {
// 	const date = new Date();
// 	const result = await api().test.date(date);

// 	expect(result).toEqual({
// 		hello: date,
// 	});
// });

// it('Send a number and receive a response', async () => {
// 	const result = await api().test.number(123);
// 	expect(result).toEqual({
// 		hello: 123,
// 	});
// });

// it('Send a boolean and receive a response', async () => {
// 	const result = await api().test.boolean({ boolean: true });
// 	expect(result).toEqual({
// 		hello: {
// 			boolean: true,
// 		},
// 	});
// });

// it('Send a null and receive a response', async () => {
// 	const result = await api().test.null(null);

// 	expect(result).toEqual({
// 		hello: null,
// 	});
// });

// // it('Send an undefined and receive a response', async () => {
// // 	const result = await api().test.undefined();
// // 	expect(result).toEqual({
// // 		hello: undefined,
// // 	});
// // });

// it('Send a map and receive a response', async () => {
// 	const map = new Map([
// 		['hello', 'world'],
// 		['world', 'hello'],
// 	]);
// 	const result = await api().test.map(map);
// 	expect(result).toEqual({
// 		hello: map,
// 	});
// });
// it('Send a set and receive a response', async () => {
// 	const set = new Set(['hello', 'world']);
// 	const result = await api().test.set(set);
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
// 	const result = await api().test.complex(input);
// 	expect(result).toEqual({
// 		hello: input,
// 	});
// });

// it('Send a request to a path parametrized endpoint and receive a response', async () => {
// 	try {
// 		const result2 = await api().parametrized2.update({
// 			name: longString,
// 		});

// 		// const payload = Array.from({ length: 1 }).fill(longString).join('');
// 		// const data = formify(payload);

// 		expect(result2).toStrictEqual({
// 			name: longString,
// 		});
// 	} catch (error) {
// 		console.log({ error });
// 	}
// });
