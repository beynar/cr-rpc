import { DurableObject } from 'cloudflare:workers';
import {
	Handler,
	DurableOptions,
	Env,
	Router,
	Session,
	getHandler,
	WSAPI,
	createRecursiveProxy,
	error,
	getErrorAsJson,
	handleError,
	handleRequest,
	stringify,
	parse,
	withCookies,
	Locals,
	SendOptions,
	Tags,
	Participant,
	SessionData,
	DurableMeta,
	StaticHandler,
	Cookies,
	DurableRequestEvent,
	WebsocketInputRequestEvent,
	WebsocketOutputRequestEvent,
	QueueHandler,
	validate,
	MaybePromise,
} from '.';
import { rateLimit } from './ratelimit';
import { getPath } from './requestEvent';

const getDefaultBroadcastPresenceTag = (opts?: DurableOptions) =>
	opts?.broadcastPresenceTo && opts?.broadcastPresenceTo !== 'ALL' && opts?.broadcastPresenceTo !== 'NONE'
		? opts?.broadcastPresenceTo
		: opts?.broadcastPresenceTo || 'ALL';

export const serializeAttachment = (ws: WebSocket, value: Session) => {
	ws.serializeAttachment(stringify(value));
};

export const deserializeAttachment = (ws: WebSocket): Session => {
	return parse(ws.deserializeAttachment()) as Session;
};

type ArrayBufferMessageHandler = (payload: { ws: WebSocket; message: ArrayBuffer; object: DurableServer }) => MaybePromise<void>;

export class DurableServer extends DurableObject<any> {
	public ctx: DurableObjectState;
	public env: Env;
	opts?: DurableOptions;
	// @ts-expect-error this will be set in the constructor by blocking concurrency if needed
	locals: Locals;
	router: Router = {} as Router;
	in: Router = {} as Router;
	out: Router = {} as Router;
	meta = {} as DurableMeta;
	onArrayBufferMessage?: ArrayBufferMessageHandler;

	setPresence = async ({ participant, sessionData }: { participant: Participant; sessionData?: SessionData }) => {
		const sessions = await this.getSessions();
		const session = sessions.find((s) => s.session.participant.id === participant.id);
		if (session) {
			const newSession = {
				...session.session,
				data: sessionData || {},
				participant,
			} satisfies Session;
			serializeAttachment(session.ws, newSession);

			this.sendPresence();
			return newSession;
		}
	};
	event = <D extends {}>(
		rest: D,
	): {
		ctx: DurableObjectState;
		env: Env;
		locals: Locals;
		static: StaticHandler;
		queue: QueueHandler['send'];
	} & D => {
		return Object.assign(rest, {
			ctx: this.ctx,
			env: this.env,
			locals: this.locals,
			static: new StaticHandler(this.env, this.ctx),
			queue: new QueueHandler(this.env, this.ctx, this.opts?.queues).send,
		});
	};

	durableEvent = (request: Request) => {
		const event = this.event({
			path: [],
			request,
			url: new URL(request.url),
			cookies: new Cookies(request),
			meta: this.meta,
		}) satisfies DurableRequestEvent;
		getPath(event);
		return event;
	};

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const locals = this.opts?.locals;
		ctx.blockConcurrencyWhile(async () => {
			if (typeof locals === 'function') {
				this.locals = await locals(env, ctx);
			} else if (locals) {
				this.locals = locals;
			}
			if (this.opts?.blockConcurrencyWhile) {
				await this.opts.blockConcurrencyWhile(this);
			}
		});
		this.env = env;
		this.ctx = ctx;
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	createSender =
		<O extends Router>(out: O) =>
		(
			{ omit, to = 'ALL' }: SendOptions = {
				to: 'ALL',
				omit: [],
			},
		) =>
			createRecursiveProxy(async ({ type, data }) => {
				if (!out) {
					throw error('SERVICE_UNAVAILABLE');
				}

				const sessions = this.getSessions(typeof to === 'string' && to !== 'ALL' ? to : undefined)
					.filter((s) => s.session.connected)
					.filter(
						typeof to === 'function'
							? to
							: ({ session }) => {
									if (omit && omit.length > 0) {
										return !omit.includes(session.participant.id);
									}
									if (to === 'ALL' || !to) {
										return true;
									} else if (Array.isArray(to)) {
										return to.includes(session.participant.id);
									}
									return true;
								},
					);

				if (sessions.length) {
					const handler = getHandler(out, type.split('.')) as Handler<any, any, any, any>;
					const parsedData = await validate(handler?.schema, data);
					const event = this.event({ to: sessions });
					const ctx = await handler?.call(event, parsedData);
					sessions.forEach(({ ws }) => {
						ws.send(stringify({ type, data: parsedData, ctx }));
					});
				}
			}) as WSAPI<O>;

	setMeta(meta: DurableMeta) {
		this.meta = meta;
	}

	async handleRpc(request: Request) {
		const event = this.durableEvent(request);
		try {
			return withCookies(await handleRequest(event, this.router), event);
		} catch (error) {
			return handleError(error);
		}
	}

	async fetch(request: Request) {
		if (!this.out && !this.in) {
			throw error('SERVICE_UNAVAILABLE');
		}
		let session: Session | undefined = undefined;
		let ws: WebSocket | undefined = undefined;
		try {
			const [client, server] = Object.values(new WebSocketPair());
			ws = server;
			const event = this.durableEvent(request);
			let {
				session: sessionData = {},
				participant = { id: crypto.randomUUID() },
				tags = [],
			} = (await this.opts?.getSessionDataAndParticipant?.({ event, object: this })) || {};

			if (!participant.id) {
				participant.id = crypto.randomUUID();
			}

			session = {
				id: crypto.randomUUID(),
				participant,
				connected: true,
				createdAt: Date.now(),
				data: sessionData,
				meta: this.meta,
			};

			serializeAttachment(server, session);

			this.ctx.acceptWebSocket(server, tags);
			this.sendPresence();

			return withCookies(
				new Response(null, {
					status: 101,
					webSocket: client,
				}),
				event,
			);
		} catch (error) {
			this.opts?.onError?.({ error, ws, session, object: this });
			return handleError(error);
		}
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') {
			return this.onArrayBufferMessage?.({ ws, message, object: this });
		}

		const session = deserializeAttachment(ws);
		try {
			if (!this.in) {
				throw error('SERVICE_UNAVAILABLE');
			}
			const { type, data } = parse(message as string);

			const event = this.event({ from: { session, ws } });
			this.opts?.rateLimiters &&
				this.opts?.rateLimiters &&
				(await rateLimit(this.env, this.opts?.rateLimiters, Object.assign({}, event, { type, data })));

			const handler = getHandler(this.in, String(type).split('.')) as Handler<any, any, any, any>;

			const parsedData = await validate(handler?.schema, data);
			await handler?.call(event, parsedData);
		} catch (error) {
			this.opts?.onError?.({ error, ws, session, message, object: this });
			const { body, status, statusText } = getErrorAsJson(error);
			ws.send(stringify({ type: 'error', data: { ...JSON.parse(body), status, statusText } }));
		}
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		setTimeout(() => {
			this.sendPresence();
		});
	}
	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		setTimeout(() => {
			this.sendPresence();
		});
	}

	getSessions = (tag?: Tags) => {
		return this.ctx.getWebSockets(tag).map((ws) => ({
			session: deserializeAttachment(ws),
			ws,
		}));
	};

	sendPresence = (tag: Tags | undefined = getDefaultBroadcastPresenceTag(this.opts)) => {
		const webSockets: WebSocket[] = [];
		if (this.opts?.broadcastPresenceTo === 'NONE' && !tag) {
			// If some tag is passed this options will overtake the default options we will broadcast presence
			return;
		}
		const participants = this.getSessions(tag === 'ALL' ? undefined : tag)
			.filter(({ ws, session }) => {
				if (session.connected !== true) {
					return false;
				}
				webSockets.push(ws);
				return true;
			})
			.map(({ session: { participant } }) => participant);

		webSockets.forEach((value) => {
			value.send(stringify({ type: 'presence', data: participants }));
		});
	};
}

export const createDurableServer = (opts?: DurableOptions) => {
	return class extends DurableServer {
		opts = opts;
	};
};
