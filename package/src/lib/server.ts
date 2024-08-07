import {
	CorsPair,
	Handler,
	error,
	handleError,
	createRequestEvent,
	handleRequest,
	RequestEvent,
	Router,
	Env,
	Locals,
	MaybePromise,
	DurableServer,
	InferDurableApi,
	Server,
} from '.';

export const getHandler = (router: Router, path: string[]) => {
	type H = Router | Handler<any, any, any> | undefined;
	let handler: H = router;
	path.forEach((segment) => {
		handler = handler?.[segment as keyof typeof handler] ? (handler?.[segment as keyof typeof handler] as H) : undefined;
	});
	return (handler ? handler : null) as Handler<any, any, any> | null;
};

type DurableObjects = Record<
	string,
	{
		prototype: DurableServer;
	}
>;

const getDurableServer = <O extends DurableObjects>(
	request: Request,
	env: Env,
	objects?: O,
): [undefined | DurableObjectStub<DurableServer>, boolean] => {
	if (!objects) return [undefined, false];
	const url = new URL(request.url);
	const objectId = request.headers.get('x-flarepc-object-id') || url.searchParams.get('id');
	const objectName = request.headers.get('x-flarepc-object-name') || url.searchParams.get('object');
	const isWebSocketConnect = !!objectId && !!objectName && url.pathname.endsWith('/connect');

	if (objectName && objectName in objects) {
		const id = (env[objectName as keyof typeof env] as any).idFromName(objectId);

		const stub = (env[objectName as keyof typeof env] as any).get(id) as DurableObjectStub<DurableServer>;
		return [stub, isWebSocketConnect];
	}
	return [undefined, false];
};
export const createServer = <R extends Router, O extends DurableObjects>({
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
		const requestEvent = await createRequestEvent.bind(ctx)(request, env, ctx, locals);
		let response: Response | undefined;

		$: try {
			for (let handler of before.concat(cors?.preflight || []) || []) {
				response = (await handler(requestEvent)) ?? response;
				if (response) break $;
			}
			const [stub, isWebSocketConnect] = getDurableServer(request, env, objects);

			if (stub) {
				if (isWebSocketConnect) {
					const upgradeHeader = request.headers.get('Upgrade');
					if (!upgradeHeader || upgradeHeader !== 'websocket') {
						return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
					}
					return stub.fetch(request);
				} else {
					response = await stub.handleRpc(request);
				}
			} else {
				const handler = getHandler(router, requestEvent.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					response = await handleRequest(requestEvent, handler);
				}
			}
		} catch (error) {
			c?.(error);
			response = handleError(error);
		}

		for (let handler of after.concat(cors?.corsify || []) || []) {
			response = (await handler(response!, requestEvent)) ?? response;
		}

		return response!;
	},
	infer: {} as {
		router: R;
		objects: {
			[K in keyof O]: InferDurableApi<O[K]['prototype']>;
		};
	} satisfies Server,
});
