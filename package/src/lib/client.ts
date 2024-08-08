import type { Client, MaybePromise, Server } from './types';
import { deform, form } from './deform';
import { createWebSocketConnection } from './websocket';
import { tryParse } from './utils';

export type DObject<O = string> = {
	name?: O;
	id?: string;
	call: boolean;
	websocket: boolean;
	jurisdiction?: DurableObjectJurisdiction;
	locationHint?: DurableObjectLocationHint;
};

const defaultObject = () => ({
	name: undefined,
	id: undefined,
	call: false,
	websocket: false,
});
export const createRecursiveProxy = (
	callback: (opts: { path: string[]; payload: any; object: DObject; callbackFunction: any }) => unknown,
	object: DObject = defaultObject(),
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
				// mean that it's the last path and the api is effectively called
				if (!object.call) {
					object.name = undefined;
					object.id = undefined;
				} else if (path[path.length - 1] === 'connect' && path.length === 2 && path[0] === object.name) {
					// If connect is called on the object, it means that we're are trying to connect to a websocket
					object.websocket = true;
					object.call = false;
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
				object.id = args[0];
			} else {
				object.call = true;
			}
			return createRecursiveProxy(callback, object, path, args[0], args[1]);
		},
	});
	return proxy;
};

export const createClient = <S extends Server>(
	{
		endpoint = '/api',
		headers,
		fetch: f = fetch,
		onError = () => {},
	}: {
		endpoint?: string;
		headers?: HeadersInit | (<I = unknown>({ path, input }: { path: string; input: I }) => MaybePromise<HeadersInit>);
		fetch?: typeof fetch;
		onError?: (error: unknown, response: Response) => void;
	} = {
		endpoint: '/api',
		onError: () => {},
	},
) => {
	return createRecursiveProxy(async ({ path, payload, object, callbackFunction }) => {
		if (object.websocket) {
			return createWebSocketConnection(payload, `${endpoint}/${path.join('/')}`, object);
		}
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
			// @ts-ignore
			credentials: 'include',
			// @ts-ignore
			keepalive: true,

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
				object.call || object.websocket
					? {
							'x-flarepc-object-name': object.name,
							'x-flarepc-object-id': object.id,
							'x-flarepc-websocket': object.websocket,
						}
					: {},
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
	}) as Client<S>;
};
