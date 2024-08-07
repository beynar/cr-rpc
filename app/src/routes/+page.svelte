<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type API } from '../api';

	let ws = $state<API['TestDurable']['ws']>();

	onMount(async () => {
		const wes = await api.TestDurable('test').connect({
			dedupeConnection: true,
			onError(error) {
				console.log(error);
			},
			onPresence: (data) => {
				console.log('presence', data, 'helleaeazlea');
			},
			handlers: {
				message: ({ data, ctx }) => {
					console.log(data);
				},

				test: {
					test: ({ data, ctx }) => {
						console.log(data);
					},
					test2: ({ data, ctx }) => {
						console.log(data);
					}
				}
			}
		});
		ws = wes;
		wes.send.test.test.test({ name: 'lkez' });
	});
</script>

<div class="grid bg-slate-200 h-screen grid-cols-2 gap-4 p-10">
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.TestDurable('test').test.test.test({
				name: 'world'
			});
			console.log(result);
		}}
	>
		Test a procedure on the durable object
	</button>
	<button
		class="shadow-md rounded-lg h-fit bg-white p-4"
		onclick={async () => {
			const result = await api.text();
			console.log(result);
		}}
	>
		Test a normal procedure on the worker
	</button>
	{#if ws}
		<button
			class="shadow-md rounded-lg h-fit bg-white p-4"
			onclick={async () => {
				ws?.send.ark({
					name: 'world',
					platform: 'android',
					versions: ['1', '2', '3']
				});
			}}
		>
			send message
		</button>
	{/if}
</div>
