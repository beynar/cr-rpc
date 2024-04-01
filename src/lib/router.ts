import { PreparedHandler, RequestEvent, Router, Env, Locals, RouterPaths, RegisteredRouter } from './types';
import { createCookies } from './cookies';
import { CorsPair } from './cors';
import { formDataToJson, jsonToFormData, tryParse } from './utils';

const getHandler = (router: Router, path: string[]) => {
	type H = Router | PreparedHandler<any, any, any> | undefined;
	let handler: H = router;
	path.forEach((segment) => {
		handler = handler?.[segment as keyof typeof handler] ? (handler?.[segment as keyof typeof handler] as H) : undefined;
	});
	return (handler ? handler : null) as any | null;
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
	locals?: Locals;
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
			{ locals },
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

			const handler = getHandler(router, path);

			console.log({ path, handler, method, isClientRequest });
			const requestData =
				method === 'GET'
					? JSON.parse(decodeURIComponent(new URLSearchParams(url.search).get('input') || '{}'))
					: isClientRequest
						? formDataToJson(await request.formData())
						: await request.json();

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
							'Content-Type': isClientRequest ? 'multipart/form-data; boundary="abcd"' : 'application/json',
						};
					} else {
						delete headers['Content-Type'];
					}
					result = isClientRequest ? jsonToFormData(result, 'result') : JSON.stringify({ result });
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

		return response!;
	},
});
