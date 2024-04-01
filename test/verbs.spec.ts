import { it, expect } from 'vitest';
import worker, { AppRouter } from '../src/index';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createClient } from '../src/lib/client';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
async function f(this, _endpoint: any, body: any) {
	const request = new IncomingRequest(_endpoint, body);
	const ctx = createExecutionContext();
	await waitOnExecutionContext(ctx);
	const res = worker.fetch(request, env, ctx);
	this.method = body.method;
	return res;
}

it('Should use the right http verb', async () => {
	let THIS = { method: 'any' };
	const api = createClient<AppRouter>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: f.bind(THIS),
	});
	const result = await api.httpVerbs.get();
	expect(result).toEqual({
		hello: 'world',
	});
	expect(THIS.method).toBe('GET');
});
it('Should use the right http verb', async () => {
	let THIS = { method: 'any' };
	const api = createClient<AppRouter>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: f.bind(THIS),
	});
	const result = await api.httpVerbs.update();
	expect(result).toEqual({
		hello: 'world',
	});
	console.log(THIS.method);
	expect(THIS.method).toBe('UPDATE');
});
it('Should use the right http verb', async () => {
	let THIS = { method: 'any' };
	const api = createClient<AppRouter>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: f.bind(THIS),
	});
	const result = await api.httpVerbs.patch();
	expect(result).toEqual({
		hello: 'world',
	});
	expect(THIS.method).toBe('PATCH');
});
it('Should use the right http verb', async () => {
	let THIS = { method: 'any' };
	const api = createClient<AppRouter>({
		endpoint: 'https://example.com',
		// @ts-ignore
		fetch: f.bind(THIS),
	});
	const result = await api.httpVerbs.delete();
	expect(result).toEqual({
		hello: 'world',
	});
	expect(THIS.method).toBe('DELETE');
});
