import type { API, MaybePromise, Router, StreamCallback } from './types';
import { tryParse, jsonToFormData, formDataToJson } from './utils';

export const createRecursiveProxy = (callback: (opts: { path: string[]; args: unknown[] }) => unknown, path: string[]) => {
	const proxy: unknown = new Proxy(() => {}, {
		get(_obj, key) {
			if (typeof key !== 'string') return undefined;
			return createRecursiveProxy(callback, [...path, key]);
		},
		apply(_1, _2, args) {
			return callback({
				path,
				args,
			});
		},
	});
	return proxy;
};

export const createClient = <R extends Router>(
	{
		endpoint = '/api',
		headers,
		fetch: f = fetch,
		onError = () => {},
	}: {
		endpoint?: string;
		headers?: HeadersInit | (<I = unknown>({ path, input }: { path: string; input: I }) => MaybePromise<HeadersInit>);
		fetch?: typeof fetch;
		onError?: (error: unknown) => void;
	} = {
		endpoint: '/api',
		onError: () => {},
	},
) => {
	return createRecursiveProxy(async ({ path, args }) => {
		let method = 'POST';
		const maybeVerb = path[path.length - 1];
		const verbs = new Set(['get', 'put', 'delete', 'patch']);
		if (verbs.has(maybeVerb)) {
			path.pop();
			method = maybeVerb.toUpperCase();
		}
		return f(`${endpoint}/${path.join('/')}${method === 'GET' ? '' : ''}`, {
			method,
			body: method === 'GET' ? undefined : jsonToFormData(args[0]),
			headers: Object.assign(
				{
					'x-wrpc-client': 'true',
				},
				typeof headers === 'function'
					? await headers({
							path: path.join('/'),
							input: args[0],
						})
					: headers,
			),
		}).then(async (res) => {
			if (res.headers.get('content-type') === 'text/event-stream') {
				const reader = res.body!.getReader();
				const decoder = new TextDecoder();
				let buffer = '';
				let first = true;
				const callback = (chunk: string, done: boolean) => {
					if (done) {
						return;
					}
					const lines = (buffer + chunk).split('\n');
					buffer = lines.pop()!;
					lines.forEach((line, i) => {
						if (first && i === 0 && line === '') {
							return;
						}
						(args[1] as any)({
							chunk: tryParse(line),
							first,
						});
						first = false;
					});
				};
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					callback(decoder.decode(value), done);
				}
			} else if (res.headers.get('content-type')?.includes('multipart/form-data')) {
				const formData = await res.formData();
				const result = formDataToJson(formData as FormData, 'result') as { result: unknown };

				if (res.ok) {
					return result;
				} else {
					onError(result);
				}
			} else if (res.headers.get('content-disposition')?.includes('filename')) {
				return new File([await res.arrayBuffer()], res.headers.get('content-disposition')?.split('filename=')[1] || 'file');
			}
		});
	}, []) as API<R>;
};
