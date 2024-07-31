import { router, type Router } from './router.new';
import { procedure } from './procedure.new';
import { object, string } from 'valibot';

export class PathParam<Param extends string, R extends Router<R, Param>> {
	param: Param;
	router: R;
	constructor(param: Param, router: R) {
		this.param = param;
		this.router = router;
	}
}

export const path = <const Param extends string, R extends Router<R, Param>>(
	param: Param,
	router: R,
): Record<`[${Param}]`, Router<R, Param>> => {
	return {
		[`[${param}]`]: new PathParam(param, router).router as Router<R, Param>,
	} as Record<`[${Param}]`, Router<R, Param>>;
};

const routes = router(
	{
		user: {
			test: procedure().handle(async ({ event, ctx, params }) => {
				return {
					hello: 'world',
				};
			}),
			get: procedure(() => {
				return {
					hello: 'world',
				};
			})
				.input(
					object({
						name: string('Not ok'),
					}),
				)
				.handle(async ({ input, event, ctx, params }) => {
					return {
						hello: input,
					};
				}),
			...path('id', {
				update: procedure(() => {
					return {
						hello: 'world',
					};
				})
					.input(
						object({
							name: string(),
						}),
					)
					.handle(async ({ input, event, ctx, params }) => {
						return {
							hello: params.id,
						};
					}),
			}),
		},
	},
	['id'],
);

type R = ReturnType<(typeof routes.user.test)['handleFunction']>;
