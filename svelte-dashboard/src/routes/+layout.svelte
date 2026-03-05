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
    let sidebarOpen = $state(true);

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
    {#if !isLoginPage && sidebarOpen}
        <Sidebar
            {isDark}
            {toggleTheme}
            toggleSidebar={() => (sidebarOpen = false)}
        />
    {/if}
    {#if !isLoginPage && !sidebarOpen}
        <button
            class="fixed left-3 top-1/2 -translate-y-1/2 z-40 w-8 h-8 rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted"
            onclick={() => (sidebarOpen = true)}
            aria-label="Show sidebar"
        >
            <span class="sr-only">Show sidebar</span>
            &gt;
        </button>
    {/if}
    <main
        class="flex-1 overflow-y-auto {isLoginPage
            ? 'flex items-center justify-center p-0 bg-muted/30'
            : 'p-8'}"
    >
        {@render children()}
    </main>
</div>
