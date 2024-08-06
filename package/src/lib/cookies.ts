import { CookieSerializeOptions } from 'cookie';
// const cookie = {}
const serialize = (name: string, value: string, opt: CookieSerializeOptions = {}): string => {
	let cookie = `${name}=${value}`;

	if (opt && typeof opt.maxAge === 'number' && opt.maxAge >= 0) {
		cookie += `; Max-Age=${Math.floor(opt.maxAge)}`;
	}

	if (opt.domain) {
		cookie += `; Domain=${opt.domain}`;
	}

	if (opt.path) {
		cookie += `; Path=${opt.path}`;
	}

	if (opt.expires) {
		cookie += `; Expires=${opt.expires.toUTCString()}`;
	}

	if (opt.httpOnly) {
		cookie += '; HttpOnly';
	}

	if (opt.secure) {
		cookie += '; Secure';
	}

	if (opt.sameSite) {
		cookie += `; SameSite=${opt.sameSite}`;
	}

	if (opt.partitioned) {
		cookie += '; Partitioned';
	}

	return cookie;
};
export const createCookies = (request: Request) => {
	const requestCookies: Map<string, string> = new Map();
	const responseCookies = new Map();

	const createRequestCookies = () => {
		const cookieHeader = request.headers.get('cookie');
		if (cookieHeader) {
			var index = 0;
			while (index < cookieHeader.length) {
				var eqIdx = cookieHeader.indexOf('=', index);
				if (eqIdx === -1) {
					break;
				}
				var endIdx = cookieHeader.indexOf(';', index);

				if (endIdx === -1) {
					endIdx = cookieHeader.length;
				} else if (endIdx < eqIdx) {
					index = cookieHeader.lastIndexOf(';', eqIdx - 1) + 1;
					continue;
				}
				var key = cookieHeader.slice(index, eqIdx).trim();
				// only assign once
				if (!requestCookies.has(key)) {
					var val = cookieHeader.slice(eqIdx + 1, endIdx).trim();

					// quoted values
					if (val.charCodeAt(0) === 0x22) {
						val = val.slice(1, -1);
					}
					requestCookies.set(key, decodeURIComponent(val));
				}

				index = endIdx + 1;
			}
		}
	};

	const get = (name: string) => {
		if (!requestCookies) {
			createRequestCookies();
		}
		return requestCookies!.get(name);
	};
	const set = (name: string, value: string, options: CookieSerializeOptions) => {
		responseCookies.set(name, { value, options });
	};
	const deleteCookie = (name: string, options: CookieSerializeOptions) => {
		responseCookies.set(name, { value: '', options: { ...options, expires: new Date(0) } });
	};
	const cookiefy = (response: Response) => {
		if (responseCookies.size > 0) {
			response.headers.set(
				'Set-Cookie',
				Array.from(responseCookies.entries())
					.map(([name, { value, options }]) => serialize(name, encodeURIComponent(value), options))
					.join('; '),
			);
		}
		return response;
	};
	return { get, set, delete: deleteCookie, cookiefy };
};

export type Cookies = ReturnType<typeof createCookies>;
