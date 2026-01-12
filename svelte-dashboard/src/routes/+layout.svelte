<script lang="ts">
	import "../app.css";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { initProjects, auth } from "$lib/stores";
	import { get } from "svelte/store";
	import { goto } from "$app/navigation";

	let { children } = $props();
	let isLoginPage = $derived($page.url.pathname === "/login");

	let isDark = $state(false);

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}

	$effect(() => {
		const authData = $auth;

		if (!authData.token && !isLoginPage) {
			goto("/login");
		} else if (authData.token && isLoginPage) {
			goto("/");
		}

		if (authData.token) {
			initProjects();
		}
	});

	onMount(() => {
		const savedTheme = localStorage.getItem("theme");
		if (
			savedTheme === "dark" ||
			(!savedTheme &&
				window.matchMedia("(prefers-color-scheme: dark)").matches)
		) {
			isDark = true;
			document.documentElement.classList.add("dark");
		}
	});
</script>

<div
	class="flex h-screen w-full bg-background text-foreground font-sans selection:bg-primary/30 transition-colors duration-300 overflow-hidden"
>
	{#if !isLoginPage}
		<Sidebar {isDark} {toggleTheme} />
	{/if}
	<main
		class="flex-1 overflow-y-auto {isLoginPage
			? 'flex items-center justify-center p-0 bg-muted/30'
			: 'p-8'}"
	>
		{@render children()}
	</main>
</div>
