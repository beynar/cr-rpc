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
} from '.';

type SendOptions = {
	to?: 'ALL' | (string & {}) | (string[] & {});
	omit?: string | string[];
};

export const createDurableServer = <_IN extends Router, _OUT extends Router>(opts?: DurableOptions, topicsIn?: _IN, topicsOut?: _OUT) => {
	return class DurableServer<R extends Router = Router, IN extends _IN = _IN, OUT extends _OUT = _OUT> extends DurableObject<any> {
		public ctx: DurableObjectState;
		public env: Env;
		// @ts-ignore
		id: string;
		state: DurableObjectState;
		storage: DurableObjectStorage;

		router?: R;
		topicsIn?: IN;
		topicsOut?: OUT;

		constructor(ctx: DurableObjectState, env: Env) {
			super(ctx, env);
			this.state = ctx;
			this.storage = ctx.storage;
			this.env = env;
			this.ctx = ctx;
			this.env = env;
			this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
		}

		send = (
			{ omit, to = 'ALL' }: SendOptions = {
				to: 'ALL',
				omit: [],
			},
		) =>
			createRecursiveProxy(async ({ type, data }) => {
				if (!topicsOut) {
					throw error('SERVICE_UNAVAILABLE');
				}
				const sessions = this.getSessions().filter(({ ws, session }) => {
					if (session.connected !== true) {
						return false;
					}
					if (omit && omit.length > 0) {
						return !omit.includes(session.participant.id);
					}
					if (to === 'ALL' || !to) {
						return true;
					} else {
						return [to].flat().includes(session.participant.id);
					}
				});

				if (sessions.length) {
					const [{ session }] = sessions;
					const handler = getHandler(topicsOut, type.split('.')) as Handler<any, any, any, any>;
					const parsedData = await parse(handler?.schema, data);
					const ctx = await handler?.call(
						{
							object: session.object,
							sessions,
						} as any,
						parsedData,
						this,
					);

					sessions.forEach(({ ws }) => {
						ws.send(socketify({ type, data: parsedData, ctx }));
					});
				}
			}) as WSAPI<_OUT>;

		async handleRpc(request: Request, object?: ObjectInfo) {
			const requestEvent = createDurableRequestEvent(request, object);
			try {
				if (!this.router) {
					throw error('SERVICE_UNAVAILABLE');
				}
				this.id = request.headers.get('x-flarepc-object-id') as string;
				const handler = getHandler(this.router, requestEvent.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					const response = await handleRequest(requestEvent as any, handler, this);
					return withCookies(response, requestEvent);
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
				const event = createDurableRequestEvent(request);

				let { session: sessionData = {}, participant = { id: crypto.randomUUID() } } =
					(await opts?.getSessionDataAndParticipant?.({ event, object: this })) || {};

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
				this.state.acceptWebSocket(server);
				this.sendPresence();

				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			} catch (error) {
				opts?.onError?.({ error, ws, session, object: this });
				return handleError(error);
			}
		}

		async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
			const { type, data } = socketiparse(message as string);
			const session = deserializeAttachment(ws);
			if (!topicsIn) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				await opts?.onMessage?.({ ws, session, message, object: this });
				const handler = getHandler(topicsIn, String(type).split('.')) as Handler<any, any, any, any>;
				const parsedData = await parse(handler?.schema, data);

				await handler?.call(
					{
						session,
						ws,
						object: session.object,
					} as any,
					parsedData,
					this,
				);
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

		getSessions = () => {
			return this.ctx.getWebSockets().map((ws) => ({
				session: deserializeAttachment(ws),
				ws,
			}));
		};

		sendPresence = () => {
			const webSockets: WebSocket[] = [];
			const participants = this.getSessions()
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
