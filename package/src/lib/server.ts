import {
	CorsPair,
	Handler,
	error,
	handleError,
	handleRequest,
	RequestEvent,
	Router,
	Env,
	Locals,
	MaybePromise,
	InferDurableApi,
	GetObjectJurisdictionOrLocationHint,
	cors as corsHandler,
	withCookies,
	Queues,
	StaticServerOptions,
	createStaticServer,
	ProcedureRateLimiters,
	CombinedRouters,
	QueueHandler,
	StaticHandler,
	getPath,
	rateLimit,
	DurableServer,
	socketiparse,
	FLARERROR,
	QueueRequestEvent,
	Cookies,
	parse,
} from '.';

export const getHandler = (router: Router, path: string[]) => {
	type H = Router | Handler<any, any, any, any> | undefined;
	let handler: H = router;
	path.forEach((segment) => {
		handler = handler?.[segment as keyof typeof handler] ? (handler?.[segment as keyof typeof handler] as H) : undefined;
	});
	if (!handler || !(handler instanceof Handler)) {
		throw error('NOT_FOUND', 'handler not found');
	}
	return handler as Handler<any, any, any, any>;
};

type DurableObjects = Record<
	string,
	{
		prototype: DurableServer;
	}
>;

const getMetaFromRequest = async ({
	event,
	getObjectJurisdictionOrLocationHint,
}: {
	event: RequestEvent;

	getObjectJurisdictionOrLocationHint?: GetObjectJurisdictionOrLocationHint;
}): Promise<void> => {
	const url = event.request.url;
	const [name, id] = url.match(/\/\(([^:]+):([^)]+)\)/)?.slice(1) || [null, null];
	event.meta.name = name;
	event.meta.id = id;
	const { jurisdiction = null, locationHint = null } =
		name && id && getObjectJurisdictionOrLocationHint ? await getObjectJurisdictionOrLocationHint(event) : {};
	event.meta.jurisdiction = jurisdiction;
	event.meta.locationHint = locationHint;
};

const getJurisdictionalNamespace = <O extends DurableObjectNamespace<DurableServer>>(
	namespace: O,
	jurisdiction: DurableObjectJurisdiction | null,
): O => {
	if (!jurisdiction) {
		return namespace;
	}
	try {
		return namespace.jurisdiction(jurisdiction) as O;
	} catch (error) {
		// We must be in a dev env and the jurisdictional setting is not available
		return namespace;
	}
};

const getDurableServer = async <O extends DurableObjects>({
	event,
	objects,
}: {
	event: RequestEvent;
	objects?: O;
}): Promise<DurableObjectStub<DurableServer> | null> => {
	const { name, id, jurisdiction, locationHint } = event.meta;

	if (!objects || !name) return null;

	if (id && name && name in objects) {
		let namespace = event.env[name as keyof typeof event.env] as DurableObjectNamespace<DurableServer>;
		const stubId = getJurisdictionalNamespace(namespace, jurisdiction).idFromName(id);
		const stub = (event.env[name as keyof typeof event.env] as any as DurableObjectNamespace<DurableServer>).get(
			stubId,
			locationHint ? { locationHint: locationHint } : {},
		) as DurableObjectStub<DurableServer>;

		return stub;
	}
	return null;
};

const executeFetch = async (
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	{
		router,
		before = [],
		after = [],
		locals = {},
		cors,
		onError: c,
		objects,
		getObjectJurisdictionOrLocationHint,
		queues,
		static: staticOptions,
		rateLimiters,
	}: ServerOptions,
): Promise<Response> => {
	// Cors are enabled by default with very permissive options to smoothen the usage and allows cookies to be used.
	if (!cors && cors !== false) {
		cors = corsHandler();
	}

	const event = {
		ctx,
		env,
		path: [],
		locals: typeof locals === 'function' ? await locals(request, env, ctx) : locals,
		queue: new QueueHandler(env, ctx, queues).send,
		request,
		static: new StaticHandler(env, ctx),
		meta: {
			name: null,
			id: null,
			jurisdiction: null,
			locationHint: null,
			server: null,
		},
		url: new URL(request.url),
		cookies: new Cookies(request),
	} satisfies RequestEvent;
	getPath(event);
	await getMetaFromRequest({ event, getObjectJurisdictionOrLocationHint });
	const stub = await getDurableServer({ event, objects });
	const isWebSocketConnect = request.headers.get('Upgrade') === 'websocket';

	let response: Response | undefined;
	$: try {
		for (let handler of before.concat((cors as CorsPair)?.preflight || [], createStaticServer(staticOptions)) || []) {
			response = (await handler(event)) ?? response;
			if (response) break $;
		}

		if (!isWebSocketConnect && rateLimiters) {
			await rateLimit(env, rateLimiters, event);
		}

		if (stub && event.meta?.name && event.meta?.id) {
			await stub.setMeta(event.meta);
			if (isWebSocketConnect) {
				response = await stub.fetch(request);
			} else {
				response = await stub.handleRpc(request);
			}
		} else {
			response = await handleRequest(event, router);
		}
	} catch (error) {
		c?.(error);
		response = handleError(error);
	}

	for (let handler of after.concat((cors as CorsPair)?.corsify || []) || []) {
		response = (await handler(response!, event)) ?? response;
	}

	return withCookies(response!, event);
};

const executeQueues = (queues: Queues, locals?: LocalsOptions) => ({
	async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
		return Promise.all(
			batch.messages.map(async (message) => {
				if (typeof message.body === 'string') {
					const { type, payload } = socketiparse(message.body);
					const path = type.split('.');
					const handler = getHandler(queues!, path) as Handler<any, any, any, any>;
					const event = {
						batch,
						ctx,
						env,
						locals: typeof locals === 'function' ? await locals(new Request('$__QUEUE_REQUEST___$'), env, ctx) : {},
						message,
						path,
					} satisfies QueueRequestEvent;
					return await handler.call(event, socketiparse(parse(handler?.schema, payload)));
				}
			}),
		);
	},
});

type LocalsOptions = Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>);
type ServerOptions<R extends Router = Router, O extends DurableObjects = DurableObjects> = {
	router: R;
	locals?: LocalsOptions;
	before?: ((event: RequestEvent) => MaybePromise<Response | void>)[];
	after?: ((response: Response, event: RequestEvent) => MaybePromise<Response | void>)[];
	onError?: (error: unknown) => Response | void;
	queues?: Queues;
	cors?: CorsPair | false;
	getObjectJurisdictionOrLocationHint?: GetObjectJurisdictionOrLocationHint;
	objects?: O;
	static?: StaticServerOptions;
	rateLimiters?: ProcedureRateLimiters;
};

type CombinedServerOptions = Record<string, ServerOptions>;

export const createServer = <R extends Router, O extends DurableObjects>(otps: ServerOptions<R, O>) => ({
	async fetch(r: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return executeFetch(r, env, ctx, otps);
	},
	infer: {} as {
		router: R;
		objects: O extends DurableObjects ? { [K in keyof O]: InferDurableApi<O[K]['prototype']> } : undefined;
	},
	queues: otps.queues ? executeQueues(otps.queues, otps.locals) : undefined,
});

export const createServers = <CS extends CombinedServerOptions>(opts: CS) => {
	const servers = Object.keys(opts);
	return {
		async fetch(request: Request, env: Env, ctx: ExecutionContext) {
			const server = servers.find((server) => request.url.includes(`[${server}]`));
			console.log({ server });
			if (!server || !(server in opts)) {
				return handleError(new FLARERROR('NOT_FOUND', 'server not found'));
			}
			const serverOptions = opts[server];
			return executeFetch(request, env, ctx, Object.assign({}, serverOptions, { basePath: server }));
		},
		queues: opts.queues ? executeQueues(combineQueues(opts), opts.locals) : undefined,
		infer: {} as {
			[K in keyof CS]: {
				router: CS[K]['router'];
				objects: CS[K]['objects'] extends DurableObjects
					? { [KK in keyof CS[K]['objects']]: InferDurableApi<CS[K]['objects'][KK]['prototype']> }
					: undefined;
			};
		},
	};
};

export const combineRouters = <R extends Router[]>(...routers: R) => {
	const router: Router = {};
	for (const r of routers) {
		Object.assign(router, r);
	}
	return router as CombinedRouters<R>;
};

export const combineQueues = (opts: CombinedServerOptions) => {
	const QUEUES: Queues = {};
	for (const server in opts) {
		const queues = opts[server].queues;
		if (queues) {
			for (const queue in queues) {
				if (queue in QUEUES) {
					QUEUES[queue] = combineRouters(QUEUES[queue], queues[queue]);
				} else {
					Object.assign(QUEUES, {
						[queue]: queues[queue],
					});
				}
			}
		}
	}

	return QUEUES;
};
