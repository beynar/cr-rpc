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
	CronRequestEvent,
	CorsOptions,
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
	[event.meta.name, event.meta.id] = event.request.url.match(/\/\(([^:]+):([^)]+)\)/)?.slice(1) || [null, null];

	if (event.meta.id === 'random') {
		event.meta.id = crypto.randomUUID();
	}

	if (event.meta.name && event.meta.id && getObjectJurisdictionOrLocationHint) {
		const localization = await getObjectJurisdictionOrLocationHint(event);
		Object.assign(event.meta, {
			jurisdiction: localization?.jurisdiction || null,
			locationHint: localization?.locationHint || null,
		});
	}
};

const getJurisdictionalNamespace = (
	namespace: DurableObjectNamespace<DurableServer>,
	jurisdiction: DurableObjectJurisdiction | null,
): DurableObjectNamespace<DurableServer> => {
	if (!jurisdiction) {
		return namespace;
	}
	try {
		return namespace.jurisdiction(jurisdiction);
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
		onError,
		objects,
		getObjectJurisdictionOrLocationHint,
		queues,
		static: staticOptions,
		rateLimiters,
	}: ServerOptions,
	server: string | null = null,
): Promise<Response> => {
	// Cors are enabled by default with very permissive options to smoothen the usage and allows cookies to be used.

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
			server,
		},
		url: new URL(request.url),
		cookies: new Cookies(request),
	} satisfies RequestEvent;
	getPath(event);
	await getMetaFromRequest({ event, getObjectJurisdictionOrLocationHint });
	const stub = await getDurableServer({ event, objects });
	const isWebSocketConnect = request.headers.get('Upgrade') === 'websocket';

	const corsOptions = typeof cors === 'function' ? await cors(event) : cors;
	const { preflight, corsify } =
		corsOptions === false
			? {
					preflight: null,
					corsify: null,
				}
			: corsHandler(corsOptions);

	let response: Response | undefined;
	$: try {
		for (let handler of before.concat(preflight || [], createStaticServer(staticOptions)) || []) {
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
		onError?.({ error, event });
		response = handleError(error);
	}

	for (let handler of after.concat(corsify || []) || []) {
		response = (await handler(response!, event)) ?? response;
	}

	return withCookies(response!, event);
};

const executeQueue = (batch: MessageBatch, env: Env, ctx: ExecutionContext, router: Router, { locals }: ServerOptions) => {
	return Promise.all(
		batch.messages.map(async (message) => {
			if (typeof message.body === 'string') {
				const { type, payload } = socketiparse(message.body);
				const path = type.split('.');

				const handler = getHandler(router, path) as Handler<any, any, any, any>;
				const event = {
					batch,
					ctx,
					env,
					locals: typeof locals === 'function' ? await locals(new Request('https://queue.request.dev'), env, ctx) : {},
					message,
					path,
				} satisfies QueueRequestEvent;
				try {
					await handler.call(event, parse(handler?.schema, payload));
					message.ack();
				} catch (error) {
					if (message.attempts < 10) {
						message.retry();
					} else {
						console.error(error, event);
					}
				}
			}
		}),
	);
};

type CronHandler = (event: CronRequestEvent) => void;
type LocalsOptions = Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>);
type ServerOptions<R extends Router = Router, O extends DurableObjects = DurableObjects> = {
	router: R;
	locals?: LocalsOptions;
	before?: ((event: RequestEvent) => MaybePromise<Response | void>)[];
	after?: ((response: Response, event: RequestEvent) => MaybePromise<Response | void>)[];
	onError?: (errorPayload: { error: unknown; event: RequestEvent }) => Response | void;
	queues?: Queues;
	cors?: false | CorsOptions | ((event: RequestEvent) => MaybePromise<CorsOptions>);
	getObjectJurisdictionOrLocationHint?: GetObjectJurisdictionOrLocationHint;
	objects?: O;
	static?: StaticServerOptions;
	rateLimiters?: ProcedureRateLimiters;
	crons?: Record<string, CronHandler>;
};

type CombinedServerOptions = Record<string, ServerOptions>;

const executeCron = async (controller: ScheduledController, env: Env, ctx: ExecutionContext, handler: CronHandler, opts: ServerOptions) => {
	const event = Object.assign(controller, {
		ctx,
		env,
		locals: typeof opts.locals === 'function' ? await opts.locals(new Request('https://cron.request.dev'), env, ctx) : opts.locals,
		queue: new QueueHandler(env, ctx).send,
	}) satisfies CronRequestEvent;
	return handler(event);
};

export const createServer = <R extends Router, O extends DurableObjects>(opts: ServerOptions<R, O>) => ({
	async fetch(r: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return executeFetch(r, env, ctx, opts);
	},
	infer: {} as {
		router: R;
		objects: O extends DurableObjects ? { [K in keyof O]: InferDurableApi<O[K]['prototype']> } : undefined;
	},
	queue: opts.queues
		? (batch: MessageBatch, env: Env, ctx: ExecutionContext) => executeQueue(batch, env, ctx, opts.queues![batch.queue], opts)
		: undefined,
	scheduled: opts.crons
		? (event: ScheduledController, env: Env, ctx: ExecutionContext) => executeCron(event, env, ctx, opts.crons![event.cron], opts)
		: undefined,
});

export const createServers = <CS extends CombinedServerOptions>(opts: CS) => {
	const servers = Object.keys(opts);
	const crons = combineCrons(opts);
	const queues = combineQueues(opts);
	return {
		async fetch(request: Request, env: Env, ctx: ExecutionContext) {
			const server = servers.find((server) => request.url.includes(`[${server}]`));

			if (!server || !(server in opts)) {
				return handleError(new FLARERROR('NOT_FOUND', 'server not found'));
			}

			return executeFetch(request, env, ctx, opts[server], server);
		},
		queue: queues
			? (batch: MessageBatch, env: Env, ctx: ExecutionContext) => {
					const { router, server } = queues[batch.queue];
					return executeQueue(batch, env, ctx, router, opts[server]);
				}
			: undefined,
		scheduled: crons
			? (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
					const { handler, server } = crons[controller.cron];
					return executeCron(controller, env, ctx, handler, opts[server]);
				}
			: undefined,
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

export const combineCrons = (opts: CombinedServerOptions) => {
	let hasCrons = false;
	const CRONS: Record<
		string,
		{
			server: string;
			handler: CronHandler;
		}
	> = {};
	for (const server in opts) {
		for (const cron in opts[server].crons) {
			hasCrons = true;
			const handler = opts[server]!.crons![cron];
			Object.assign(CRONS, {
				[cron]: {
					server,
					handler,
				},
			});
		}
	}
	return hasCrons ? CRONS : undefined;
};

export const combineQueues = (opts: CombinedServerOptions) => {
	const QUEUES: Record<
		string,
		{
			router: Router;
			server: string;
		}
	> = {};
	let hasQueues = false;
	for (const server in opts) {
		const queues = opts[server].queues;
		if (queues) {
			hasQueues = true;
			for (const queue in queues) {
				if (queue in QUEUES) {
					QUEUES[queue].router = combineRouters(QUEUES[queue].router, queues[queue]);
				} else {
					Object.assign(QUEUES, {
						[queue]: {
							router: queues[queue],
							server,
						},
					});
				}
			}
		}
	}
	return hasQueues ? QUEUES : undefined;
};
