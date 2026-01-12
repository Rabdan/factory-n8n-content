<script lang="ts">
	import { page } from "$app/stores";
	import {
		LayoutDashboard,
		Calendar,
		BarChart3,
		FileText,
		Settings,
		FolderKanban,
		Moon,
		Sun,
		LogOut,
		Plus,
	} from "@lucide/svelte";
	import {
		projects,
		currentProject,
		addProject,
		selectProject,
		auth,
	} from "$lib/stores";
	import { goto } from "$app/navigation";

	let { isDark, toggleTheme } = $props();

	function logout() {
		auth.set({ user: null, token: null });
		goto("/login");
	}

	const links = [
		{ href: "/", label: "Dashboard", icon: LayoutDashboard },
		{ href: "/calendar", label: "Content calendar", icon: Calendar },
		{ href: "/analytics", label: "Analytics", icon: BarChart3 },
		{ href: "/files", label: "Files (RAG)", icon: FileText },
		{ href: "/settings", label: "Settings", icon: Settings },
	];

	let showAddProjectModal = $state(false);
	let newProjectName = $state("");

	function handleAddProject() {
		if (newProjectName.trim()) {
			addProject(newProjectName.trim());
			newProjectName = "";
			showAddProjectModal = false;
			goto("/settings");
		}
	}

	function switchProject(project: { id: number; name: string }) {
		selectProject(project.id);
		goto("/");
	}
</script>

<aside
	class="w-64 border-r border-border bg-muted/20 dark:bg-muted/10 h-full p-4 flex flex-col gap-4 transition-colors duration-300 overflow-hidden"
>
	<div class="font-bold text-xl px-2 mb-1 flex items-center gap-3">
		<div
			class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-md"
		>
			<FolderKanban size={24} />
		</div>
		<span class="dark:text-foreground italic tracking-tight"
			>Content Factory</span
		>
	</div>
	<div class="px-2 mb-4">
		<span class="text-sm font-medium text-muted-foreground"
			>{$currentProject?.name}</span
		>
	</div>

	<nav class="flex flex-col gap-1">
		{#each links as link}
			{@const Icon = link.icon}
			<a
				href={link.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground {$page
					.url.pathname === link.href
					? 'bg-accent font-medium text-accent-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Icon size={20} />
				{link.label}
			</a>
		{/each}
	</nav>

	<div class="mt-auto space-y-3">
		<!-- Theme Toggle -->
		<button
			onclick={toggleTheme}
			class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
		>
			{#if isDark}
				<Sun size={20} />
				<span>Light Mode</span>
			{:else}
				<Moon size={20} />
				<span>Dark Mode</span>
			{/if}
		</button>

		<!-- Logout -->
		<button
			onclick={logout}
			class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
		>
			<LogOut size={20} />
			<span>Logout</span>
		</button>

		<div class="border-t border-border pt-4">
			<div class="text-xs text-muted-foreground px-2 mb-2">Projects</div>
			<div class="flex flex-col gap-1">
				{#each $projects as project}
					<button
						onclick={() => switchProject(project)}
						class="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 {$currentProject?.id ===
						project.id
							? 'bg-accent font-medium text-accent-foreground'
							: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
					>
						<div
							class="w-2 h-2 rounded-full"
							class:bg-green-500={$currentProject?.id ===
								project.id}
						></div>
						{project.name}
					</button>
				{/each}
			</div>
			<button
				onclick={() => (showAddProjectModal = true)}
				class="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
			>
				<Plus size={20} />
				<span>Add Project</span>
			</button>
		</div>
	</div>
</aside>

{#if showAddProjectModal}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
		onclick={(e) =>
			e.currentTarget === e.target && (showAddProjectModal = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") showAddProjectModal = false;
		}}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	>
		<div class="bg-card p-6 rounded-lg shadow-xl w-full max-w-md">
			<h2 class="text-lg font-semibold mb-4">Add New Project</h2>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleAddProject();
				}}
			>
				<input
					type="text"
					bind:value={newProjectName}
					placeholder="Enter project name"
					class="w-full px-3 py-2 border border-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
				/>
				<div class="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onclick={() => (showAddProjectModal = false)}
						class="px-4 py-2 rounded-lg hover:bg-muted"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
						>Create</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
