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
	GetObjectJurisdictionOrLocationHint,
	Server,
	ObjectInfo,
	withCookies,
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

const getDurableServer = async <O extends DurableObjects>(
	request: Request,
	env: Env,
	objects?: O,
	getObjectJurisdictionOrLocationHint?: GetObjectJurisdictionOrLocationHint,
): Promise<[undefined | DurableObjectStub<DurableServer>, boolean, ObjectInfo | undefined]> => {
	if (!objects) return [undefined, false, undefined];
	const isProduction = env['ENVIRONMENT' as keyof typeof env] === 'development';
	const url = new URL(request.url);
	const objectId = request.headers.get('x-flarepc-object-id') || url.searchParams.get('id') || 'DEFAULT';
	const objectName = request.headers.get('x-flarepc-object-name') || url.searchParams.get('object');
	const isWebSocketConnect = !!objectId && !!objectName && url.pathname.endsWith('/connect');

	if (!objectName) return [undefined, false, undefined];

	if (objectName && objectName in objects) {
		let namespace = env[objectName as keyof typeof env] as any as DurableObjectNamespace<DurableServer>;
		const { jurisdiction = undefined, locationHint = undefined } = (await getObjectJurisdictionOrLocationHint?.({
			request,
			object: {
				name: objectName,
				id: objectId,
			},
			env,
		})) || {
			jurisdiction: undefined,
			locationHint: undefined,
		};
		const id = !!jurisdiction && isProduction ? namespace.jurisdiction(jurisdiction).idFromName(objectId) : namespace.idFromName(objectId);

		const stub = (env[objectName as keyof typeof env] as any as DurableObjectNamespace<DurableServer>).get(
			id,
			isProduction ? { locationHint } : {},
		) as DurableObjectStub<DurableServer>;

		return [
			stub,
			isWebSocketConnect,
			{
				name: objectName,
				id: objectId,
				jurisdiction,
				locationHint,
			},
		];
	}
	return [undefined, false, undefined];
};

export const createServer = <R extends Router, O extends DurableObjects>({
	router,
	before = [],
	after = [],
	locals = {},
	cors,
	catch: c,
	objects,
	getObjectJurisdictionOrLocationHint,
}: {
	router: R;
	locals?: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>);
	before?: ((event: RequestEvent) => Response | void)[];
	after?: ((response: Response, event: RequestEvent) => Response | void)[];
	catch?: (error: unknown) => Response | void;
	cors?: CorsPair;
	getObjectJurisdictionOrLocationHint?: GetObjectJurisdictionOrLocationHint;
	objects?: O;
}) => ({
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const [stub, isWebSocketConnect, object] = await getDurableServer(request, env, objects, getObjectJurisdictionOrLocationHint);
		const requestEvent = await createRequestEvent(request, env, ctx, object, locals);

		let response: Response | undefined;
		$: try {
			for (let handler of before.concat(cors?.preflight || []) || []) {
				response = (await handler(requestEvent)) ?? response;
				if (response) break $;
			}

			if (stub && object?.name && object?.id) {
				if (isWebSocketConnect) {
					const upgradeHeader = request.headers.get('Upgrade');
					if (!upgradeHeader || upgradeHeader !== 'websocket') {
						return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
					}

					const clone = request.clone();
					Object.assign(clone.cf || {}, {
						object,
					});
					return stub.fetch(clone);
				} else {
					response = await stub.handleRpc(request, object);
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

		return withCookies(response!, requestEvent);
	},
	infer: {} as {
		router: R;
		objects: {
			[K in keyof O]: InferDurableApi<O[K]['prototype']>;
		};
	} satisfies Server,
});
