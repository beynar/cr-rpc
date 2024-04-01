// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import { z } from 'zod';
import { object, string } from 'valibot';

const zSchema = z.object({
	name: z.string(),
});

const VSchema = object({
	name: string(),
});

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

it('Hello World worker', async () => {
	// const request = new IncomingRequest(
	// 	`http://example.com/user?input=${encodeURIComponent(
	// 		JSON.stringify({
	// 			name: 'true',
	// 		}),
	// 	)}`,
	// 	{
	// 		method: 'GET',
	// 		// body: JSON.stringify({
	// 		// 	name: 'true',
	// 		// }),
	// 	},
	// );
	// const request = new IncomingRequest(`http://example.com/test`, {
	// 	method: 'POST',
	// 	headers: {
	// 		'x-wrpc-client': 'true',
	// 		contentType: 'application/form-data',
	// 	},
	// 	body: inputToFormData({
	// 		name: true,
	// 	}),
	// });
	// // // Create an empty context to pass to `worker.fetch()`.
	// const ctx = createExecutionContext();
	// const response = await worker.fetch(request, env, ctx);
	// // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
	// await waitOnExecutionContext(ctx);
	// console.log(JSON.stringify(await response.json(), null, 3));
	// expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

	// const input = {
	// 	name: 'hello',
	// };

	// try {
	// } catch (error) {
	// 	console.log(error.message);
	// }
	// const zResult = zSchema._parse({ path: [], parent: {}, data: input });
	// const vResult = VSchema._parse(input);

	// const output = zResult.success ? zResult.data : zResult.error;

	// console.log('z', zResult.error, 'v', vResult.issues);
	// const error = zResult.error || vResult.issues;
	// if(error) {
	// 	throw new Error(JSON.stringify({
	// }
	// if (error) {
	// 	console.log('errror');
	// }
	// console.log({ zResult }, { vResult });

	expect(true).toBe(true);
});
