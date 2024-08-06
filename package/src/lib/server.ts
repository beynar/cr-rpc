import { RequestEvent, Router, Env, Locals, MaybePromise, DurableServer, InferDurableApi, Server } from './types';
import { createCookies } from './cookies';
import { CorsPair } from './cors';
import { Handler } from './procedure';
import { error, handleError } from './error';
import { handleRequest } from './request';

export const getHandler = (router: Router, path: string[]) => {
	type H = Router | Handler<any, any, any> | undefined;
	let handler: H = router;
	path.forEach((segment) => {
		handler = handler?.[segment as keyof typeof handler] ? (handler?.[segment as keyof typeof handler] as H) : undefined;
	});
	return (handler ? handler : null) as Handler<any, any, any> | null;
};

export const createPartialRequestEvent = async (
	request: Request,
	locals: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>),
	env: Env,
	ctx: ExecutionContext,
): Promise<Partial<RequestEvent>> => {
	const url = new URL(request.url);
	let path = url.pathname.split('/').filter(Boolean);
	let objectId = request.headers.get('x-flarepc-object-id') || url.searchParams.get('id');
	let objectName = request.headers.get('x-flarepc-object-name') || url.searchParams.get('object');
	const isWebSocketConnect = !!objectId && !!objectName && url.pathname.endsWith('/connect');
	const method = request.method;
	if (method !== 'POST' && !isWebSocketConnect) {
		path.push(method.toLocaleLowerCase());
	}
	if (objectId && objectName) {
		path = path.slice(1);
	}

	return Object.assign(
		{},
		{
			path,
			isWebSocketConnect,
			locals: typeof locals === 'function' ? await locals(request, env, ctx) : locals,
			objectId,
			objectName,
			request,
			url,
			caches,
			cookies: createCookies(request),
		},
	);
};
export const createRequestEvent = (partialEvent: Partial<RequestEvent>, env: Env, ctx: ExecutionContext): RequestEvent => {
	return Object.assign({}, ctx, partialEvent, env) as RequestEvent;
};

export const createServer = <
	R extends Router,
	const O extends Record<
		string,
		{
			prototype: DurableServer;
		}
	>,
>({
	router,
	before = [],
	after = [],
	locals = {},
	cors,
	catch: c,
	objects,
}: {
	router: R;
	locals?: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>);
	before?: ((event: RequestEvent) => Response | void)[];
	after?: ((response: Response, event: RequestEvent) => Response | void)[];
	catch?: (error: unknown) => Response | void;
	cors?: CorsPair;
	objects?: O;
}) => ({
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const partialEvent = await createPartialRequestEvent(request, locals, env, ctx);
		const event = createRequestEvent(partialEvent, env, ctx);
		let response: Response | undefined;
		console.log(request);

		$: try {
			for (let handler of before.concat(cors?.preflight || []) || []) {
				response = (await handler(event)) ?? response;
				if (response) break $;
			}
			const objectClass = event.objectName ? objects?.[event.objectName] : null;
			if (objectClass) {
				let id = (env[event.objectName as keyof typeof env] as any).idFromName(event.objectId);

				let stub = (env[event.objectName as keyof typeof env] as any).get(id) as DurableObjectStub<DurableServer>;

				console.log(event.isWebSocketConnect);
				if (event.isWebSocketConnect) {
					const upgradeHeader = request.headers.get('Upgrade');
					if (!upgradeHeader || upgradeHeader !== 'websocket') {
						return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
					}
					await stub.handleWebSocket(request, locals, event.objectId as string);
					return stub.fetch(request);
				} else {
					response = await stub.handleRpc(request, locals);
				}
			} else {
				const handler = getHandler(router, event.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					response = await handleRequest(event, handler);
				}
			}
		} catch (error) {
			console.log('error', error);
			c?.(error);
			response = handleError(error);
		}

		for (let handler of after.concat(cors?.corsify || []) || []) {
			response = (await handler(response!, event)) ?? response;
		}

		return response!;
	},
	infer: {
		router: {},
		objects: {},
	} as {
		router: R;
		objects: {
			[K in keyof O]: InferDurableApi<O[K]['prototype']>;
		};
	} satisfies Server,
});
