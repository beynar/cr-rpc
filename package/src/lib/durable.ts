import { DurableObject } from 'cloudflare:workers';
import {
	Handler,
	DurableOptions,
	Env,
	Router,
	Session,
	getHandler,
	parse,
	WSAPI,
	createRecursiveProxy,
	error,
	getErrorAsJson,
	handleError,
	createDurableRequestEvent,
	handleRequest,
	deserializeAttachment,
	serializeAttachment,
	socketify,
	socketiparse,
	ObjectInfo,
	withCookies,
	Locals,
	SendOptions,
	Tags,
} from '.';
import { rateLimit } from './ratelimit';

export const createDurableServer = (opts: DurableOptions) => {
	const defaultBroadcastPresenceTag =
		opts.broadcastPresenceTo && opts.broadcastPresenceTo !== 'ALL' && opts.broadcastPresenceTo !== 'NONE'
			? opts.broadcastPresenceTo
			: opts.broadcastPresenceTo || 'ALL';
	return class DurableServer<
		R extends Router = Router,
		IN extends Router = Router,
		OUT extends Router = Router,
	> extends DurableObject<any> {
		public ctx: DurableObjectState;
		public env: Env;
		// @ts-expect-error this will be set in the constructor by blockConcurrency if needed
		locals: Locals;
		// @ts-ignore
		state: DurableObjectState;
		storage: DurableObjectStorage;
		router?: R;
		topicsIn?: IN;
		topicsOut?: OUT;

		constructor(ctx: DurableObjectState, env: Env) {
			super(ctx, env);
			const locals = opts.locals;
			if (typeof locals === 'function') {
				ctx.blockConcurrencyWhile(async () => {
					this.locals = await locals(env, ctx);
				});
			} else if (locals) {
				this.locals = locals;
			}
			this.state = ctx;
			this.storage = ctx.storage;
			this.env = env;
			this.ctx = ctx;
			this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
		}

		send = (
			{ omit, to = 'ALL' }: SendOptions = {
				to: 'ALL',
				omit: [],
			},
		) =>
			createRecursiveProxy(async ({ type, data }) => {
				if (!this.topicsOut) {
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
					const handler = getHandler(this.topicsOut, type.split('.')) as Handler<any, any, any, any>;
					const parsedData = await parse(handler?.schema, data);
					const ctx = await handler?.call(
						{
							object: sessions[0].session.object,
							to: sessions,
						} as any,
						parsedData,
						this,
					);

					sessions.forEach(({ ws }) => {
						ws.send(socketify({ type, data: parsedData, ctx }));
					});
				}
			}) as WSAPI<OUT>;

		async handleRpc(request: Request, object: ObjectInfo) {
			const requestEvent = createDurableRequestEvent(request, this.env, this.ctx, object);
			try {
				if (!this.router) {
					throw error('SERVICE_UNAVAILABLE');
				}
				const handler = getHandler(this.router, requestEvent.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					return withCookies(await handleRequest(requestEvent as any, handler, this), requestEvent);
				}
			} catch (error) {
				return handleError(error);
			}
		}

		async fetch(request: Request) {
			let session: Session | undefined = undefined;
			let ws: WebSocket | undefined = undefined;
			const object = request.cf?.object as ObjectInfo;
			try {
				const [client, server] = Object.values(new WebSocketPair());
				ws = server;
				const event = createDurableRequestEvent(request, this.env, this.ctx, object);

				let {
					session: sessionData = {},
					participant = { id: crypto.randomUUID() },
					tags = [],
				} = (await opts?.getSessionDataAndParticipant?.({ event, object: this })) || {};

				if (!participant.id) {
					participant.id = crypto.randomUUID();
				}

				session = {
					id: crypto.randomUUID(),
					participant,
					connected: true,
					createdAt: Date.now(),
					data: sessionData,
					object,
				};

				serializeAttachment(server, session);

				this.state.acceptWebSocket(server, tags);
				this.sendPresence();

				return withCookies(
					new Response(null, {
						status: 101,
						webSocket: client,
					}),
					event,
				);
			} catch (error) {
				opts?.onError?.({ error, ws, session, object: this });
				return handleError(error);
			}
		}

		async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
			const { type, data } = socketiparse(message as string);

			const session = deserializeAttachment(ws);
			if (!this.topicsIn) {
				throw error('SERVICE_UNAVAILABLE');
			}
			const event = {
				session,
				ws,
				object: session.object,
			} as any;
			try {
				opts.rateLimiters && opts.rateLimiters && (await rateLimit(this.env, opts.rateLimiters, Object.assign({}, event, { type, data })));
				opts?.onMessage && (await opts?.onMessage?.({ ws, session, message, object: this }));
				const handler = getHandler(this.topicsIn, String(type).split('.')) as Handler<any, any, any, any>;
				if (!handler) {
					throw error('NOT_FOUND');
				}
				const parsedData = await parse(handler?.schema, data);
				await handler?.call(event, parsedData, this);
			} catch (error) {
				opts?.onError?.({ error, ws, session, message, object: this });
				const { body, status, statusText } = getErrorAsJson(error);
				ws.send(socketify({ type: 'error', data: { ...JSON.parse(body), status, statusText } }));
			}
		}
		async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
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

		sendPresence = (tag: Tags | undefined = defaultBroadcastPresenceTag) => {
			const webSockets: WebSocket[] = [];
			if (opts.broadcastPresenceTo === 'NONE' && !tag) {
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
				value.send(socketify({ type: 'presence', data: participants }));
			});
		};
	};
};
