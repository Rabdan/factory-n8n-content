<script lang="ts">
    import { goto } from "$app/navigation";
    import { FolderKanban, Lock, Mail, Loader2 } from "@lucide/svelte";

    import { auth } from "$lib/stores";
    let email = $state("");
    let password = $state("");
    let isLoading = $state(false);
    let error = $state("");

    async function handleLogin(e: Event) {
        e.preventDefault();
        isLoading = true;
        error = "";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                auth.set({ user: data.user, token: data.token });
                goto("/");
            } else {
                error = data.error || "Invalid email or password";
            }
        } catch (err) {
            error = "Connection error. Please try again.";
            console.error(err);
        } finally {
            isLoading = false;
        }
    }
</script>

<div
    class="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-xl space-y-8 animate-in fade-in zoom-in duration-300"
>
    <div class="text-center space-y-2">
        <div
            class="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg mb-4"
        >
            <FolderKanban size={32} />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Welcome Back</h1>
        <p class="text-muted-foreground">
            Sign in to your Content Factory account
        </p>
    </div>

    <form onsubmit={handleLogin} class="space-y-6">
        <div class="space-y-4">
            <div class="space-y-2">
                <label
                    for="email"
                    class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >Email or Username</label
                >
                <div class="relative">
                    <Mail
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size={18}
                    />
                    <input
                        id="email"
                        type="text"
                        bind:value={email}
                        placeholder="admin"
                        class="flex h-11 w-full rounded-xl border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                    />
                </div>
            </div>
            <div class="space-y-2">
                <label
                    for="password"
                    class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >Password</label
                >
                <div class="relative">
                    <Lock
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size={18}
                    />
                    <input
                        id="password"
                        type="password"
                        bind:value={password}
                        placeholder="••••••••"
                        class="flex h-11 w-full rounded-xl border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                    />
                </div>
            </div>
        </div>

        {#if error}
            <p
                class="text-sm text-destructive text-center font-medium animate-bounce"
            >
                {error}
            </p>
        {/if}

        <button
            type="submit"
            disabled={isLoading}
            class="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70"
        >
            {#if isLoading}
                <Loader2 class="animate-spin" size={20} />
                Signing in...
            {:else}
                Sign In
            {/if}
        </button>
    </form>

    <div class="text-center text-sm text-muted-foreground">
        Don't have an account? <a
            href="#"
            class="text-primary hover:underline font-medium"
            >Contact administration</a
        >
    </div>
</div>
