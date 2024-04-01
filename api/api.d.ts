import { CookieSerializeOptions } from 'cookie';
import * as valibot from 'valibot';
import { BaseSchema, Input } from 'valibot';
import { Schema as Schema$1, infer } from 'zod';

declare const createCookies: (request: Request) => {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options: CookieSerializeOptions) => void;
    delete: (name: string, options: CookieSerializeOptions) => void;
    cookiefy: (response: Response) => Response;
};
type Cookies = ReturnType<typeof createCookies>;

interface Register {
}
type Env = Register extends {
    Env: infer _Env;
} ? _Env : {};
type Locals = Register extends {
    Locals: infer _Locals;
} ? _Locals : {};
type RegisteredRouter = Register extends {
    Router: infer _Router;
} ? _Router extends Router ? _Router : never : never;
type Schema = Schema$1 | BaseSchema;
type SchemaInput<S extends Schema> = S extends Schema$1 ? infer<S> : S extends BaseSchema ? Input<S> : never;
type MaybePromise<T> = T | Promise<T>;
type StreamCallback<C = string> = {
    onStart?: () => MaybePromise<void>;
    onChunk?: (onChunk: {
        chunk: C;
        first: boolean;
    }) => MaybePromise<void>;
    onEnd?: (chunks: C[]) => MaybePromise<void>;
};
type Middleware<T = any> = (event: RequestEvent) => MaybePromise<T>;
type RequestEvent = {
    cookies: Cookies;
    request: Request;
    url: URL;
    waitUntil: ExecutionContext['waitUntil'];
    passThroughOnException: ExecutionContext['passThroughOnException'];
    route: RouterPaths<RegisteredRouter, '', '/'>;
} & Env & (Locals extends never ? {} : {
    locals: Locals;
});
type HandleFunction<S extends Schema | undefined, M extends Middleware[] | undefined> = (payload: HandlePayload<S, M>) => MaybePromise<any>;
type HandlePayload<S extends Schema | undefined, M extends Middleware[] | undefined> = (S extends Schema ? {
    event: RequestEvent;
    input: SchemaInput<S>;
} : {
    event: RequestEvent;
}) & {
    ctx: ReturnOfMiddlewares<M>;
};
type ReturnOfMiddlewares<Use extends Middleware[] | undefined, PreviousData = unknown> = Use extends Middleware[] ? Use extends [infer Head, ...infer Tail] ? Head extends Middleware<infer HeadData> ? Tail extends Middleware[] ? PreviousData & HeadData & ReturnOfMiddlewares<Tail, PreviousData & HeadData> : HeadData & PreviousData : PreviousData : unknown : unknown;
type AnyHandler = {
    call: (event: any, input: any) => MaybePromise<any>;
    parse: (data: any) => MaybePromise<any>;
};
type Router = {
    [K: string]: AnyHandler | Router;
};
type API<R extends Router = Router> = {
    [K in keyof R]: R[K] extends Router ? APIRoute<R[K]> : R[K] extends AnyHandler ? PreparedHandlerType<R[K]> : never;
};
type PreparedHandler<S extends Schema | undefined, M extends Middleware[], H extends HandleFunction<S, M>> = {
    parse: (data: any) => Promise<S extends Schema ? SchemaInput<S> : undefined>;
    call: (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined) => Promise<ReturnType<H>>;
};
type PreparedHandlerType<H extends AnyHandler = AnyHandler> = H['call'] extends (...args: infer U) => MaybePromise<any> ? APICaller<H['call'], U[1]> : never;
type APIRoute<R extends Router> = {
    [K in keyof R]: R[K] extends Router ? APIRoute<R[K]> : R[K] extends AnyHandler ? PreparedHandlerType<R[K]> : never;
};
type APICaller<C extends AnyHandler['call'], I> = Awaited<ReturnType<C>> extends ReadableStream<infer S> ? I extends undefined ? (callback: StreamCallback<S>) => never : (input: I, callback: StreamCallback<S>) => ReturnTypeOfCaller<C> : I extends undefined ? () => ReturnTypeOfCaller<C> : (input: I) => ReturnTypeOfCaller<C>;
type ReturnTypeOfCaller<C extends AnyHandler['call']> = Awaited<ReturnType<C>> extends ReadableStream<any> ? never : Promise<Awaited<ReturnType<C>>>;
type RouterPaths<R extends Router, P extends string = '', S extends '.' | '/' = '.'> = {
    [K in keyof R]: R[K] extends Router ? P extends '' ? RouterPaths<R[K], `${string & K}`, S> : RouterPaths<R[K], `${P}${S}${string & K}`, S> : P extends '' ? `${string & K}` : `${P}${S}${string & K}`;
}[keyof R];

declare const api: API<{
    user: {
        get: PreparedHandler<valibot.ObjectSchema<{
            name: valibot.StringSchema<string>;
            map: valibot.MapSchema<valibot.StringSchema<string>, valibot.StringSchema<string>, valibot.MapOutput<valibot.StringSchema<string>, valibot.StringSchema<string>>>;
        }, undefined, {
            name: string;
            map: valibot.MapOutput<valibot.StringSchema<string>, valibot.StringSchema<string>>;
        }>, [], ({ event, input }: HandlePayload<valibot.ObjectSchema<{
            name: valibot.StringSchema<string>;
            map: valibot.MapSchema<valibot.StringSchema<string>, valibot.StringSchema<string>, valibot.MapOutput<valibot.StringSchema<string>, valibot.StringSchema<string>>>;
        }, undefined, {
            name: string;
            map: valibot.MapOutput<valibot.StringSchema<string>, valibot.StringSchema<string>>;
        }>, []>) => Promise<{
            userId: number;
        }>>;
    };
    test: {
        object: PreparedHandler<valibot.ObjectSchema<{
            name: valibot.StringSchema<string>;
        }, undefined, {
            name: string;
        }>, [], ({ input, event, ctx }: HandlePayload<valibot.ObjectSchema<{
            name: valibot.StringSchema<string>;
        }, undefined, {
            name: string;
        }>, []>) => Promise<{
            hello: string;
        }>>;
        string: PreparedHandler<valibot.StringSchema<string>, [], ({ input, event, ctx }: HandlePayload<valibot.StringSchema<string>, []>) => Promise<{
            hello: string;
        }>>;
        date: PreparedHandler<valibot.DateSchema<Date>, [], ({ input, event, ctx }: HandlePayload<valibot.DateSchema<Date>, []>) => Promise<{
            hello: Date;
        }>>;
        number: PreparedHandler<valibot.NumberSchema<number>, [], ({ input, event, ctx }: HandlePayload<valibot.NumberSchema<number>, []>) => Promise<{
            hello: number;
        }>>;
        boolean: PreparedHandler<valibot.BooleanSchema<boolean>, [], ({ input, event, ctx }: HandlePayload<valibot.BooleanSchema<boolean>, []>) => Promise<{
            hello: boolean;
        }>>;
        null: PreparedHandler<valibot.NullSchema<null>, [], ({ input, event, ctx }: HandlePayload<valibot.NullSchema<null>, []>) => Promise<{
            hello: null;
        }>>;
        undefined: PreparedHandler<valibot.UndefinedSchema<undefined>, [], ({ input, event, ctx }: HandlePayload<valibot.UndefinedSchema<undefined>, []>) => Promise<{
            hello: undefined;
        }>>;
    };
}>;

export { api };
