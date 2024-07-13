import type { API, MaybePromise, Router, StreamCallback } from './types';
import { tryParse } from './utils';
import { deform, form } from 'ampliform';

export const createRecursiveProxy = (
	callback: (opts: {
		path: string[];
		args: unknown[];
		pathParameters: { [key: string]: unknown };
		payload: any;
		callbackFunction: any;
	}) => unknown,
	path: string[],
	parameters: [string, any][] = [],
	callbackFunction: any = null,
) => {
	const proxy: unknown = new Proxy(() => {}, {
		get(_obj, key) {
			if (typeof key !== 'string') return undefined;

			const isLast = key === 'then';
			if (isLast) {
				parameters.reverse();

				const [[_lastPath, payload], ...pathParametersArray] = parameters;
				const pathParameters = pathParametersArray.reduce(
					(acc, curr) => {
						Object.assign(acc, curr);
						return acc;
					},
					{} as Record<string, boolean>,
				);
				path = path.reduce((acc, key, i) => {
					const isLast = i === path.length - 1;
					const isParametrized = key.startsWith('[') && key.endsWith(']');
					if (isLast) {
						acc.push(key.replace('[', '').replace(']', ''));
					} else if (isParametrized) {
						const parameter = parameters.find((p) => p[0] === key);
						if (parameter) {
							acc.push(parameter[1]);
						}
					} else {
						acc.push(key);
					}

					return acc;
				}, [] as string[]);

				console.log({ parameters, path, payload, _lastPath });

				return (resolve: (value: any) => void, reject: (reason?: any) => void) => {
					return resolve(
						callback({
							path,
							args: [],
							payload,
							pathParameters,
							callbackFunction,
						}),
					);
				};
			}

			return createRecursiveProxy(callback, [...path, key], parameters, callbackFunction);
		},
		apply(_1, _2, args) {
			const pathParameter = args[0];
			if (args[1]) {
				callbackFunction = args[1];
			}
			const previousPath = path.slice(0, -1);
			let pathParameterKey = path.at(-1) as string;
			if (pathParameterKey && pathParameter) {
				pathParameterKey = `[${pathParameterKey}]`;
				parameters.push([pathParameterKey, pathParameter]);
			}
			return createRecursiveProxy(callback, [...previousPath, pathParameterKey], parameters, callbackFunction);
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
	return createRecursiveProxy(async ({ path, args, payload, pathParameters, callbackFunction }) => {
		let method = 'POST';
		const maybeVerb = path[path.length - 1];
		const verbs = new Set(['get', 'put', 'delete', 'patch']);
		if (verbs.has(maybeVerb)) {
			path.pop();
			method = maybeVerb.toUpperCase();
		}
		return f(`${endpoint}/${path.join('/')}${method === 'GET' ? '' : ''}`, {
			method,
			body: method === 'GET' ? undefined : form(payload),
			headers: Object.assign(
				{
					'x-wrpc-client': 'true',
				},
				typeof headers === 'function'
					? await headers({
							path: path.join('/'),
							input: payload,
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
				if (res.ok) {
					return deform(formData as FormData);
				} else {
					onError(res.clone());
				}
			}
		});
	}, []) as API<R>;
};
