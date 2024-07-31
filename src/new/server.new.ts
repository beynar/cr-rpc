import { PreparedHandler, RequestEvent, Router, Env, Locals, RouterPaths, RegisteredRouter, API } from './types.new';
import { createCookies } from './cookies.new';
import { CorsPair } from './cors.new';
import { tryParse } from './utils.new';
import { deform, form } from 'ampliform';
import { MaybePromise } from 'valibot';
import { createRecursiveProxy } from './client';

const createCaller = <R extends Router>(router: R, event: Omit<RequestEvent, 'procedures'>) => {
	return createRecursiveProxy(async ({ path, args }) => {
		const [handler] = getHandler(router, path);
		const parsedData = await handler.parse(args[0]);
		return handler.call(event, parsedData);
	}, []) as API<R>;
};

export const getHandler = (router: Router, path: string[]) => {
	type H = Router | PreparedHandler<any, any, any> | undefined;
	let handler: H = router;
	let params: Record<string, string> = {};
	path.forEach((segment) => {
		const getAtSegment = (s: keyof typeof handler) => {
			// If handler doesn't have a property with the segment name, try to find a property that is parameterized
			return handler?.[s]
				? (handler?.[s] as H)
				: Object.entries(handler as Router).find(([key]) => {
						const match = key.match(new RegExp(`\\[(.*?)\\]`));
						if (match) {
							const param = match?.[1];
							Object.assign(params, { [param]: segment });
						}
						return !!match;
					})?.[1];
		};

		handler = getAtSegment(segment as keyof typeof handler);
	});
	return [handler as any | null, params];
};

export const createRouter = <R extends Router>({
	router,
	before = [],
	after = [],
	locals = {},
	cors,
	catch: c,
}: {
	router: R;
	locals?: Locals | ((request: Request, env: Env, ctx: ExecutionContext) => MaybePromise<Locals>);
	before?: ((event: RequestEvent) => Response | void)[];
	after?: ((response: Response, event: RequestEvent) => Response | void)[];
	catch?: (error: unknown) => Response | void;
	cors?: CorsPair;
}) => ({
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const isClientRequest = request.headers.get('x-wrpc-client') === 'true';
		const path = url.pathname.split('/').filter(Boolean);
		const method = request.method;
		if (method !== 'POST') {
			path.push(method.toLocaleLowerCase());
		}

		const event = Object.assign(
			ctx,
			env,
			{ locals: typeof locals === 'function' ? await locals(request, env, ctx) : locals },
			{
				request,
				url,
				caches,
				cookies: createCookies(request),
				route: path.join('/') as RouterPaths<RegisteredRouter, '', '/'>,
			},
		) as RequestEvent;

		let response: Response | undefined,
			status = 200,
			result: string | File | FormData | ReadableStream = JSON.stringify({
				error: {
					message: 'Not Found',
				},
			}),
			headers: Record<string, string> = { 'Content-Type': 'application/json' };
		$: try {
			for (let handler of before.concat(cors?.preflight || []) || []) {
				response = handler(event) ?? response;
				if (response) break $;
			}

			// const lastPath = path[path.length - 1];
			// const verb = ['GET', 'UPDATE', 'DELETE', 'PUT', 'PATCH', 'POST'].find((v) => v === request.method);
			// path.push(verb ? verb : lastPath);

			const [handler, params] = getHandler(router, path);
			console.log({ params });

			const requestData =
				method === 'GET'
					? JSON.parse(decodeURIComponent(new URLSearchParams(url.search).get('input') || '{}'))
					: isClientRequest
						? deform(await request.formData())
						: await request.json();
			console.log({ handler, requestData });

			if (handler && 'call' in handler) {
				result = await handler.call(event, handler.parse(requestData));

				if (result?.constructor.name === 'ReadableStream') {
					headers['Content-Type'] = 'text/event-stream';
				} else if (result && result instanceof File) {
					headers = {
						'Content-Type': result.type,
						'Content-Disposition': 'attachment; filename=' + result.name,
					};
				} else {
					if (!isClientRequest) {
						headers = {
							'Content-Type': 'application/json',
						};
					} else {
						delete headers['Content-Type'];
					}
					result = isClientRequest ? form(result) : JSON.stringify(result);
				}
			}
		} catch (error) {
			console.log({ error });
			(response = c?.(error) || response),
				(status = 500),
				(result = JSON.stringify({
					error: {
						message: tryParse((error as any).message) || 'Internal Server Error',
					},
				}));
		}
		response = response || new Response(result, { headers, status });

		for (let handler of after.concat(cors?.corsify || []) || []) {
			response = handler(response!, event) || response;
		}
		console.log({ response, result });
		return response!;
	},
});
