<script lang="ts">
    import {
        Plus,
        Trash2,
        Mail,
        Clock,
        Webhook,
        Image as ImageIcon,
        X,
        Edit,
    } from "@lucide/svelte";
    import { currentProject, selectProject } from "$lib/stores";

    const API_BASE = import.meta.env.VITE_API_URL || "";

    let inviteEmail = $state("");
    let showAddNetwork = $state(false);
    let isSaving = $state(false);
    let editingNetworkId = $state<number | null>(null);

    let newNetwork = $state({
        name: "",
        publishing_webhook_url: "",
        generation_webhook_url: "",
        default_publish_time: "10:00",
        default_prompt: "",
    });

    let logoFile: File | null = $state(null);
    let logoPreview = $state("");

    function handleFileChange(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            logoFile = target.files[0];
            logoPreview = URL.createObjectURL(logoFile);
        }
    }

    async function sendInvite() {
        if (!inviteEmail || !$currentProject) return;

        try {
            const response = await fetch(
                `/api/projects/${$currentProject.id}/invite`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email: inviteEmail }),
                },
            );

            if (response.ok) {
                alert("Invite sent successfully!");
                inviteEmail = "";
            } else {
                const error = await response.json();
                alert(`Failed to send invite: ${error.error}`);
            }
        } catch (error) {
            console.error("Error sending invite:", error);
            alert("An error occurred while sending the invite.");
        }
    }

    async function saveNetwork() {
        if (!newNetwork.name || !$currentProject) return;
        isSaving = true;

        try {
            let logo_url = "";
            if (logoFile) {
                const formData = new FormData();
                formData.append("file", logoFile);
                formData.append("project_id", $currentProject.id.toString());

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    logo_url = uploadData.filepath;
                }
            }

            const isEditing = editingNetworkId !== null;
            const url = isEditing
                ? `/api/projects/social-networks/${editingNetworkId}`
                : `/api/projects/${$currentProject.id}/social-networks`;
            const method = isEditing ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...newNetwork,
                    logo_url,
                    default_publish_time: newNetwork.default_publish_time,
                    default_prompt: newNetwork.default_prompt,
                }),
            });

            if (response.ok) {
                await selectProject($currentProject.id);
                showAddNetwork = false;
                resetForm();
                location.reload();
            } else {
                const error = await response.json();
                alert(
                    `Failed to ${isEditing ? "update" : "save"} network: ${error.error}`,
                );
            }
        } catch (error) {
            console.error("Error saving network:", error);
        } finally {
            isSaving = false;
        }
    }

    async function deleteNetwork(networkId: number) {
        if (!confirm("Are you sure you want to delete this social network?"))
            return;

        try {
            const response = await fetch(
                `/api/projects/social-networks/${networkId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                if ($currentProject) {
                    await selectProject($currentProject.id);
                }
            } else {
                const error = await response.json();
                alert(`Failed to delete network: ${error.error}`);
            }
        } catch (error) {
            console.error("Error deleting network:", error);
        }
    }

    function resetForm() {
        newNetwork = {
            name: "",
            publishing_webhook_url: "",
            generation_webhook_url: "",
            default_publish_time: "10:00",
            default_prompt: "",
        };
        logoFile = null;
        logoPreview = "";
        editingNetworkId = null;
    }

function editNetwork(network: any) {
		newNetwork = {
			name: network.name,
			publishing_webhook_url: network.publishing_webhook_url,
			generation_webhook_url: network.generation_webhook_url,
			default_publish_time: network.default_publish_time,
			default_prompt: network.default_prompt,
		};
		logoPreview = network.logo_url && !network.logo_url.startsWith("http") 
			? `/uploads/${network.logo_url}` 
			: network.logo_url || "";
		logoFile = null;
		editingNetworkId = network.id;
		showAddNetwork = true;
		
		setTimeout(() => {
			const editForm = document.querySelector('[data-edit-form]');
			editForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 100);
	}

    function getAvatar(email: string) {
        return email ? email[0].toUpperCase() : "?";
    }
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">Project Settings</h1>
        <p class="text-muted-foreground mt-1">
            Manage users, invites, and social network configurations.
        </p>
    </div>

    <!-- Team Members Section -->
    <div class="bg-card border border-border rounded-xl p-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold">Team Members</h2>
        </div>

        <!-- Invite Form -->
        <div class="flex gap-3 mb-6">
            <div class="flex-1 relative">
                <Mail
                    size={18}
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                />
                <input
                    type="email"
                    placeholder="Enter email to invite..."
                    bind:value={inviteEmail}
                    class="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
            </div>
            <button
                onclick={sendInvite}
                class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
                <Plus size={18} />
                Send Invite
            </button>
        </div>

        <!-- Members List -->
        <div class="space-y-3">
            {#if $currentProject && $currentProject.members}
                {#each $currentProject.members as member (member.id)}
                    <div
                        class="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 rounded-full bg-primary/20 text-primary font-medium flex items-center justify-center"
                            >
                                {getAvatar(member.email)}
                            </div>
                            <div>
                                <p class="font-medium text-sm">
                                    {member.email}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    {member.role}
                                </p>
                            </div>
                        </div>
                        {#if member.role !== "Owner"}
                            <button
                                class="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} class="text-destructive" />
                            </button>
                        {/if}
                    </div>
                {/each}
            {:else}
                <p class="text-muted-foreground text-sm">Loading members...</p>
            {/if}
        </div>
    </div>

    <!-- Social Networks Section -->
    <div class="bg-card border border-border rounded-xl p-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold">Social Networks</h2>
{#if !showAddNetwork}
				<button
					onclick={() => {
						showAddNetwork = true;
						setTimeout(() => {
							const editForm = document.querySelector('[data-edit-form]');
							editForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}, 100);
					}}
					class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
				>
					<Plus size={18} />
					Add Network
				</button>
			{/if}
        </div>

        <div class="space-y-6">
{#if $currentProject && $currentProject.social_networks}
				{#each $currentProject.social_networks.filter((n: any) => n.id !== editingNetworkId) as network (network.id)}
                    <div
                        class="border border-border rounded-xl p-6 hover:shadow-sm transition-shadow"
                    >
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-12 h-12 {network.color ||
                                        'bg-muted'} rounded-xl flex items-center justify-center overflow-hidden"
                                >
{#if network.logo_url}
										<img
											src={network.logo_url.startsWith(
												"http",
											)
												? network.logo_url
												: `/uploads/${network.logo_url}`}
											alt={network.name}
											class="w-full h-full object-cover"
										/>
                                    {:else}
                                        <ImageIcon
                                            size={24}
                                            class="text-muted-foreground"
                                        />
                                    {/if}
                                </div>
                                <div>
                                    <h3 class="font-semibold">
                                        {network.name}
                                    </h3>
                                    <p
                                        class="text-sm text-green-500 font-medium"
                                    >
                                        Connected
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    onclick={() => editNetwork(network)}
                                    class="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                                >
                                    <Edit size={16} class="text-primary" />
                                </button>
                                <button
                                    onclick={() => deleteNetwork(network.id)}
                                    class="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                                >
                                    <Trash2
                                        size={16}
                                        class="text-destructive"
                                    />
                                </button>
                            </div>
                        </div>

                        <div
                            class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"
                        >
                            <div>
                                <label
                                    class="text-muted-foreground flex items-center gap-2 mb-1"
                                >
                                    <Webhook size={14} />
                                    Publish Webhook
                                </label>
                                <input
                                    type="text"
                                    readonly
                                    value={network.publishing_webhook_url}
                                    class="w-full px-3 py-2 bg-muted/30 border border-input rounded-lg text-xs focus:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    class="text-muted-foreground flex items-center gap-2 mb-1"
                                >
                                    <Webhook size={14} />
                                    Generation Webhook
                                </label>
                                <input
                                    type="text"
                                    readonly
                                    value={network.generation_webhook_url}
                                    class="w-full px-3 py-2 bg-muted/30 border border-input rounded-lg text-xs focus:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    class="text-muted-foreground flex items-center gap-2 mb-1"
                                >
                                    <Clock size={14} />
                                    Default Time
                                </label>
                                <div
                                    class="px-3 py-2 bg-muted/30 border border-input rounded-lg text-sm"
                                >
                                    {network.default_publish_time}
                                </div>
                            </div>
                        </div>

                        {#if network.default_prompt}
                            <div class="mt-4">
                                <label
                                    class="text-muted-foreground text-sm mb-1 block"
                                    >Default Prompt</label
                                >
                                <div
                                    class="p-3 bg-muted/30 border border-input rounded-lg text-sm italic"
                                >
                                    {network.default_prompt}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}

{#if showAddNetwork}
				<div
					data-edit-form
					class="border-2 border-primary/20 border-dashed rounded-xl p-8 bg-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-300"
				>
                    <div class="flex items-center justify-between mb-8">
                        <h3 class="text-lg font-bold flex items-center gap-2">
                            {#if editingNetworkId}
                                <Edit size={24} class="text-primary" />
                                Edit Social Network
                            {:else}
                                <Plus size={24} class="text-primary" />
                                Add New Social Network
                            {/if}
                        </h3>
                        <button
                            onclick={() => {
                                showAddNetwork = false;
                                resetForm();
                            }}
                            class="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Name and Logo -->
                        <div class="space-y-6">
                            <div>
                                <label
                                    for="networkName"
                                    class="text-sm font-semibold mb-2 block"
                                    >Network Name</label
                                >
                                <input
                                    id="networkName"
                                    type="text"
                                    bind:value={newNetwork.name}
                                    placeholder="e.g. LinkedIn, TikTok, X"
                                    class="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div>
                                <label class="text-sm font-semibold mb-2 block"
                                    >Network Logo</label
                                >
                                <div class="flex items-center gap-6">
                                    <div
                                        class="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-background overflow-hidden shadow-inner"
                                    >
                                        {#if logoPreview}
                                            <img
                                                src={logoPreview}
                                                alt="Preview"
                                                class="w-full h-full object-cover"
                                            />
                                        {:else}
                                            <ImageIcon
                                                size={28}
                                                class="text-muted-foreground opacity-40"
                                            />
                                        {/if}
                                    </div>
                                    <label
                                        class="px-5 py-2.5 bg-background border border-border hover:border-primary/50 rounded-xl text-sm font-medium cursor-pointer transition-all shadow-sm hover:shadow-md"
                                    >
                                        Choice File
                                        <input
                                            type="file"
                                            class="hidden"
                                            accept="image/*"
                                            onchange={handleFileChange}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Webhooks -->
                        <div class="space-y-6">
                            <div>
                                <label
                                    for="pubWebhook"
                                    class="text-sm font-semibold mb-2 block flex items-center gap-2"
                                >
                                    <Webhook
                                        size={16}
                                        class="text-muted-foreground"
                                    />
                                    Publishing Webhook URL
                                </label>
                                <input
                                    id="pubWebhook"
                                    type="url"
                                    bind:value={
                                        newNetwork.publishing_webhook_url
                                    }
                                    placeholder="https://n8n.example.com/webhook/..."
                                    class="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div>
                                <label
                                    for="genWebhook"
                                    class="text-sm font-semibold mb-2 block flex items-center gap-2"
                                >
                                    <Webhook
                                        size={16}
                                        class="text-muted-foreground"
                                    />
                                    Generation Webhook URL
                                </label>
                                <input
                                    id="genWebhook"
                                    type="url"
                                    bind:value={
                                        newNetwork.generation_webhook_url
                                    }
                                    placeholder="https://n8n.example.com/webhook/..."
                                    class="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <!-- Scheduling -->
                        <div class="space-y-6">
                            <div>
                                <label
                                    for="pubTime"
                                    class="text-sm font-semibold mb-2 block flex items-center gap-2"
                                >
                                    <Clock
                                        size={16}
                                        class="text-muted-foreground"
                                    />
                                    Default Publish Time
                                </label>
                                <input
                                    id="pubTime"
                                    type="time"
                                    bind:value={newNetwork.default_publish_time}
                                    class="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <!-- Prompt -->
                        <div class="md:col-span-2">
                            <label
                                for="networkPrompt"
                                class="text-sm font-semibold mb-2 block"
                                >Default Content Prompt</label
                            >
                            <textarea
                                id="networkPrompt"
                                bind:value={newNetwork.default_prompt}
                                placeholder="Describe the tone, style, and rules for content generation on this platform..."
                                rows="4"
                                class="w-full px-4 py-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm resize-none text-sm"
                            ></textarea>
                        </div>
                    </div>

                    <div
                        class="flex justify-end gap-3 mt-10 pt-8 border-t border-primary/10"
                    >
                        <button
                            type="button"
                            onclick={() => {
                                showAddNetwork = false;
                                resetForm();
                            }}
                            class="px-6 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onclick={saveNetwork}
                            disabled={isSaving || !newNetwork.name}
                            class="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {#if isSaving}
                                <div
                                    class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                                ></div>
                                {editingNetworkId
                                    ? "Updating Network..."
                                    : "Saving Network..."}
                            {:else if editingNetworkId}
                                <Edit size={18} />
                                Update Network
                            {:else}
                                <Plus size={18} />
                                Save Network
                            {/if}
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
