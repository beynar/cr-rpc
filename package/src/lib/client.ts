import { type Client, type MaybePromise, type Server, Meta } from './types';
import { createDocumentConnection, createWebSocketConnection } from './websocket';
import { tryParse } from './utils';
import { deform, form } from './transform';

export type ClientMeta = {
	name: string | null;
	id: string | null;
	server: string | null;
	call: boolean;
	websocket: boolean;
	doc: boolean;
};

const defaultObject = () =>
	({
		name: null,
		id: null,
		server: null,
		call: false,
		websocket: false,
		doc: false,
	}) satisfies ClientMeta;

export const createRecursiveProxy = (
	callback: (opts: { path: string[]; payload: any; object: ClientMeta; callbackFunction: any }) => unknown,
	object: ClientMeta = defaultObject(),
	path: string[] = [],
	payload: unknown[] = [],
	callbackFunction: any = null,
) => {
	const proxy: unknown = new Proxy(() => {}, {
		get(_obj, key) {
			if (path.length === 0) {
				object = defaultObject();
			}
			if (typeof key !== 'string') return undefined;

			if (key === 'then') {
				const isConnect = path[path.length - 1] === 'connect';
				const isDoc = path[path.length - 1] === 'doc';
				// mean that it's the last path and the api is effectively called
				if (!object.call) {
					object.name = null;
					object.id = null;
				}
				// If connect is called on the object, it means that we're are trying to connect to a websocket
				object.websocket = isConnect;
				object.doc = isDoc;

				if (object.call || isConnect || isDoc) {
					path[0] = `(${object.name}:${object.id})`;
				}
				return (resolve: (value: any) => void, reject: (reason?: any) => void) => {
					return resolve(
						callback({
							path,
							payload,
							object,
							callbackFunction,
						}),
					);
				};
			}

			return createRecursiveProxy(callback, object, [...path, key], payload, callbackFunction);
		},
		apply(_1, _2, args) {
			if (!object.id) {
				object.name = path[path.length - 1];
				object.id = args[0] || 'DEFAULT';
			} else {
				object.call = true;
			}
			return createRecursiveProxy(callback, object, path, args[0], args[1]);
		},
	});
	return proxy;
};

export type ClientOptions = {
	endpoint: string;
	headers?: HeadersInit | (<I = unknown>({ path, input }: { path: string; input: I }) => MaybePromise<HeadersInit>);
	fetch?: typeof fetch;
	onError?: (error: unknown, response: Response) => void;
	includeCredentials?: boolean;
};

export const createClient = <
	S extends Server | Record<string, Server>,
	N extends S extends Record<string, Server> ? keyof S : never = never,
>({
	endpoint,
	headers,
	fetch: f = fetch,
	onError = () => {},
	// @ts-ignore
	server,
	includeCredentials = true,
}: ClientOptions & (S extends Record<string, Server> ? { server: N } : {})) => {
	return createRecursiveProxy(async ({ path, payload, object, callbackFunction }) => {
		const url = new URL(endpoint);
		if (server) {
			path.unshift(`[${server}]`);
		}

		url.pathname = path.join('/');

		if (object.websocket) {
			return createWebSocketConnection(url, payload);
		}

		if (object.doc) {
			return createDocumentConnection(url, payload, callbackFunction);
		}

		let method = 'POST';
		const maybeVerb = path[path.length - 1];
		const verbs = new Set(['get', 'put', 'delete', 'patch']);
		if (verbs.has(maybeVerb)) {
			path.pop();
			method = maybeVerb.toUpperCase();
		}
		if (method === 'GET') {
			url.search = new URLSearchParams(JSON.stringify(payload)).toString();
		}
		return f(url, {
			method,
			body: method === 'GET' ? undefined : form(payload),
			// @ts-ignore
			...(includeCredentials
				? {
						credentials: 'include',
					}
				: {}),

			headers: Object.assign(
				{
					'x-flarepc-client': 'true',
				},
				typeof headers === 'function'
					? await headers({
							path: path.join('/'),
							input: payload,
						})
					: headers,
			),
		}).then(async (res) => {
			if (res.status !== 200) {
				onError?.(
					{
						// @ts-ignore
						...(await res.clone().json()),
						status: res.status,
						statusText: res.statusText,
					},
					// @ts-ignore
					res.clone(),
				);
				throw new Error(res.statusText);
			} else {
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
							(callbackFunction as any)({
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
					return deform(formData as FormData);
				}
			}
		});
	}) as Client<S extends Record<string, Server> ? S[N] : S>;
};
