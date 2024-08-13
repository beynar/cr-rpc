import { error } from './error';
import {
	DurableRequestEvent,
	DurableWebsocketInputEvent,
	PickKeyType,
	ProcedureRateLimiters,
	RequestEvent,
	WebsocketRateLimiters,
	Env,
} from './types';

export const rateLimit = async <L extends ProcedureRateLimiters | WebsocketRateLimiters>(
	env: Env,
	limiters: L,
	event: RequestEvent | DurableWebsocketInputEvent | DurableRequestEvent,
) => {
	const success = await Promise.all(
		Object.entries(limiters).map(async ([key, keyExtractor]) => {
			const rateLimitKey = (keyExtractor as (event: RequestEvent | DurableWebsocketInputEvent | DurableRequestEvent) => string)(event);
			const limiter = env[key as PickKeyType<Env, RateLimit>] as RateLimit;
			if (limiter) {
				const { success } = await limiter.limit({ key: rateLimitKey });
				return success;
			}
		}),
	).then((results) => results.every((result) => !!result));
	if (!success) {
		throw error('TOO_MANY_REQUESTS');
	}
};
