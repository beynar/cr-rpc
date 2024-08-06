import { type, Type } from 'arktype';
const user = type({
	name: 'string',
	platform: "'android' | 'ios'",
	'versions?': '(number | string)[]',
});

type IN = typeof user.inferIn;
type O = Type['inferIn'];

type OUT = typeof user.infer;
