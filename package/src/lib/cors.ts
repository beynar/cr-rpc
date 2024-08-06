import { RequestEvent } from './types';

// Shamelessly copied and slightly adapted from https://github.com/kwhitley/itty-router
export type GenericTraps = Record<string, any>;
export type IRequestStrict = {
	route: string;
	params: {
		[key: string]: string;
	};
	query: {
		[key: string]: string | string[] | undefined;
	};
	proxy?: any;
} & Request;
export type IRequest = Request;
export type CorsOptions = {
	credentials?: true;
	origin?: boolean | string | string[] | RegExp | ((origin: string) => string | void);
	maxAge?: number;
	allowMethods?: string | string[];
	allowHeaders?: any;
	exposeHeaders?: string | string[];
};

export type Preflight = (event: RequestEvent) => Response | void;
export type Corsify = (response: Response, event: RequestEvent) => Response | void;

export type CorsPair = {
	preflight: Preflight;
	corsify: Corsify;
};

// Create CORS function with default options.
export const cors = (
	options: CorsOptions = {},
): {
	preflight: Preflight;
	corsify: Corsify;
} => {
	// Destructure and set defaults for options.
	const { origin = '*', credentials = false, allowMethods = '*', allowHeaders = '*', exposeHeaders = '*', maxAge } = options;

	// create generic CORS headers
	const corsHeaders: Record<string, any> = {
		'access-control-allow-headers': allowHeaders?.join?.(',') ?? allowHeaders, // include allowed headers
		// @ts-expect-error
		'access-control-expose-headers': exposeHeaders?.join?.(',') ?? exposeHeaders, // include allowed headers
		// @ts-expect-error
		'access-control-allow-methods': allowMethods?.join?.(',') ?? allowMethods, // include allowed methods
		'access-control-max-age': maxAge,
		'access-control-allow-credentials': credentials,
	};

	const getAccessControlOrigin = (request?: Request): string => {
		const requestOrigin = request?.headers.get('origin'); // may be null if no request passed

		// @ts-expect-error
		if (origin === true) return requestOrigin;
		// @ts-expect-error
		if (origin instanceof RegExp) return origin.test(requestOrigin) ? requestOrigin : undefined;
		// @ts-expect-error
		if (Array.isArray(origin)) return origin.includes(requestOrigin) ? requestOrigin : undefined;
		// @ts-expect-error
		if (origin instanceof Function) return origin(requestOrigin);

		// @ts-expect-error
		return origin == '*' && credentials ? requestOrigin : origin;
	};

	const preflight = (event: RequestEvent) => {
		if (event.request.method == 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: Object.entries({
					'access-control-allow-origin': getAccessControlOrigin(event.request),
					...corsHeaders,
				}).filter((v) => v[1]),
			});
		}
	};

	const corsify = (response: Response, event: RequestEvent) => {
		if (!response.headers.has('access-control-allow-origin')) {
			response.headers.set('access-control-allow-origin', getAccessControlOrigin(event.request));
			Object.entries(corsHeaders).forEach(([key, value]) => {
				response.headers.set(key, value);
			});
		}
	};
	return { corsify, preflight };
};
