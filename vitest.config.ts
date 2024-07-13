import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		testTimeout: 10000,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
	},
});
