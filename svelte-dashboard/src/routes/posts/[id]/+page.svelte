<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import {
        Save,
        RefreshCw,
        ArrowLeft,
        Calendar as CalIcon,
        Clock,
        Layers,
        Share2,
        CheckCircle2,
        Send,
        Image as ImageIcon,
        Type,
        Hash,
        Sparkles,
        X,
        Plus,
    } from "@lucide/svelte";
    import { currentProject } from "$lib/stores";
    import { goto } from "$app/navigation";

    let postId = page.params.id;
    let post = $state(null as any);
    let contentPlans = $state([] as any[]);
    let isSaving = $state(false);
    let isRegenerating = $state(false);

    async function fetchPost() {
        try {
            const res = await fetch(`/api/posts/${postId}`);
            if (res.ok) {
                post = await res.json();
                // Ensure tags is an array
                if (typeof post.tags === "string") {
                    try {
                        post.tags = JSON.parse(post.tags);
                    } catch {
                        post.tags = [];
                    }
                }
                if (!post.tags) post.tags = [];
                if (typeof post.media_files === "string") {
                    try {
                        post.media_files = JSON.parse(post.media_files);
                    } catch {
                        post.media_files = [];
                    }
                }
                if (!post.media_files) post.media_files = [];
            }
        } catch (err) {
            console.error("Error fetching post:", err);
        }
    }

    async function fetchContentPlans() {
        if (!$currentProject) return;
        try {
            const res = await fetch(
                `/api/projects/${$currentProject.id}/content-plans`,
            );
            if (res.ok) {
                contentPlans = await res.json();
            }
        } catch (err) {
            console.error("Error fetching content plans:", err);
        }
    }

    onMount(async () => {
        await fetchPost();
        if ($currentProject) {
            await fetchContentPlans();
        }
    });

    async function handleSave() {
        if (post.status === "published") return;
        isSaving = true;
        try {
            const res = await fetch(`/api/posts/${postId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text_content: post.text_content,
                    publish_at: post.publish_at,
                    status: post.status,
                    content_plan_id: post.content_plan_id,
                    social_network_id: post.social_network_id,
                    media_files: post.media_files,
                    tags: post.tags,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                post = { ...post, ...updated };
                alert("Post saved successfully!");
            }
        } catch (err) {
            console.error("Error saving post:", err);
        } finally {
            isSaving = false;
        }
    }

    async function handleRegenerate(type: "text" | "image" | "all") {
        if (post.status === "published") return;
        isRegenerating = true;
        try {
            const res = await fetch(`/api/posts/${postId}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            if (res.ok) {
                alert("Regeneration triggered! Please wait for updates.");
                // We might want to poll or use WS, for now just re-fetch after a delay or manually
                setTimeout(fetchPost, 3000);
            }
        } catch (err) {
            console.error("Error regenerating:", err);
        } finally {
            isRegenerating = false;
        }
    }

    function getStatusBadgeClass(status: string) {
        switch (status) {
            case "published":
                return "bg-green-500/20 text-green-500 border-green-500/50";
            case "approved":
                return "bg-blue-500/20 text-blue-500 border-blue-500/50";
            case "generated":
                return "bg-purple-500/20 text-purple-500 border-purple-500/50";
            default:
                return "bg-orange-500/20 text-orange-500 border-orange-500/50";
        }
    }

    function addTag() {
        const tag = prompt("Enter new tag:");
        if (tag) {
            post.tags = [...post.tags, tag];
        }
    }

    function removeTag(index: number) {
        post.tags = post.tags.filter((_: any, i: number) => i !== index);
    }
</script>

{#if post}
    <div
        class="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button
                    onclick={() => history.back()}
                    class="p-2 hover:bg-muted rounded-xl transition-colors border border-border"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <div class="flex items-center gap-3">
                        <h1 class="text-3xl font-black tracking-tight">
                            Edit Post
                        </h1>
                        <span
                            class="px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider {getStatusBadgeClass(
                                post.status,
                            )}"
                        >
                            {post.status}
                        </span>
                    </div>
                    <p class="text-muted-foreground text-sm font-medium">
                        Post ID: #{post.id} • {post.social_network_name ||
                            "No platform"}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-3">
                {#if post.status !== "published"}
                    <button
                        onclick={handleSave}
                        disabled={isSaving}
                        class="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {#if isSaving}
                            <RefreshCw size={18} class="animate-spin" />
                            Saving...
                        {:else}
                            <Save size={18} />
                            Save Changes
                        {/if}
                    </button>
                {:else}
                    <div
                        class="flex items-center gap-2 text-green-500 font-bold px-4 py-2 bg-green-500/10 rounded-xl border border-green-500/30"
                    >
                        <CheckCircle2 size={18} />
                        Published
                    </div>
                {/if}
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-8">
                <!-- Media Section -->
                <div
                    class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
                >
                    <div
                        class="p-6 border-b border-border flex items-center justify-between bg-muted/5"
                    >
                        <h2 class="text-xl font-bold flex items-center gap-2">
                            <ImageIcon size={22} class="text-primary" />
                            Visual Content
                        </h2>
                        {#if post.status !== "published"}
                            <button
                                onclick={() => handleRegenerate("image")}
                                disabled={isRegenerating}
                                class="text-sm font-bold flex items-center gap-2 text-primary hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Sparkles size={16} />
                                Regenerate Images
                            </button>
                        {/if}
                    </div>
                    <div class="p-8">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {#if post.media_files && post.media_files.length > 0}
                                {#each post.media_files as media, i}
                                    <div
                                        class="group relative aspect-video rounded-2xl overflow-hidden border border-border bg-muted/20 shadow-inner"
                                    >
                                        <img
                                            src={media.startsWith("http")
                                                ? media
                                                : `${import.meta.env.VITE_API_URL || ""}/uploads/${media}`}
                                            alt="Post content"
                                            class="w-full h-full object-cover"
                                        />
                                        <div
                                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                                        >
                                            <button
                                                class="bg-white/20 backdrop-blur-md p-2 rounded-lg hover:bg-white/40 transition-colors"
                                            >
                                                <RefreshCw
                                                    size={20}
                                                    class="text-white"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            {:else}
                                <div
                                    class="md:col-span-2 aspect-video rounded-2xl border-4 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/5"
                                >
                                    <ImageIcon
                                        size={48}
                                        class="mb-4 opacity-20"
                                    />
                                    <p class="font-bold text-lg opacity-40">
                                        No images generated yet
                                    </p>
                                    <p class="text-xs opacity-30 mt-2">
                                        Click regenerate to create visuals
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Text Content Section -->
                <div
                    class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
                >
                    <div
                        class="p-6 border-b border-border flex items-center justify-between bg-muted/5"
                    >
                        <h2 class="text-xl font-bold flex items-center gap-2">
                            <Type size={22} class="text-primary" />
                            Post Text
                        </h2>
                        {#if post.status !== "published"}
                            <button
                                onclick={() => handleRegenerate("text")}
                                disabled={isRegenerating}
                                class="text-sm font-bold flex items-center gap-2 text-primary hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Sparkles size={16} />
                                Regenerate Text
                            </button>
                        {/if}
                    </div>
                    <div class="p-8 space-y-6">
                        <div>
                            <textarea
                                bind:value={post.text_content}
                                disabled={post.status === "published"}
                                class="w-full min-h-[300px] bg-background border border-input rounded-2xl p-6 text-lg leading-relaxed focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none shadow-inner disabled:opacity-70"
                                placeholder="Write your content here..."
                            ></textarea>
                        </div>

                        <div class="space-y-3">
                            <label
                                class="text-sm font-bold text-muted-foreground flex items-center gap-2"
                            >
                                <Hash size={16} />
                                Tags
                            </label>
                            <div class="flex flex-wrap gap-2">
                                {#each post.tags as tag, i}
                                    <div
                                        class="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-sm font-bold"
                                    >
                                        #{tag}
                                        {#if post.status !== "published"}
                                            <button
                                                onclick={() => removeTag(i)}
                                                class="hover:text-red-500 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        {/if}
                                    </div>
                                {/each}
                                {#if post.status !== "published"}
                                    <button
                                        onclick={addTag}
                                        class="flex items-center gap-1.5 border border-dashed border-border px-3 py-1.5 rounded-full text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary transition-all"
                                    >
                                        <Plus size={14} />
                                        Add Tag
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar / Management -->
            <div class="space-y-6">
                <div
                    class="bg-card border border-border rounded-3xl p-8 shadow-xl space-y-8 sticky top-6"
                >
                    <div>
                        <h3
                            class="text-xl font-black mb-6 flex items-center gap-2"
                        >
                            <Layers size={22} class="text-primary" />
                            Management
                        </h3>

                        <div class="space-y-6">
                            <!-- Social Network -->
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Share2 size={14} />
                                    Social Network
                                </label>
                                <select
                                    bind:value={post.social_network_id}
                                    disabled={post.status === "published"}
                                    class="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                >
                                    {#if $currentProject?.social_networks}
                                        {#each $currentProject.social_networks as sn}
                                            <option value={sn.id}
                                                >{sn.name}</option
                                            >
                                        {/each}
                                    {/if}
                                </select>
                            </div>

                            <!-- Content Plan -->
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                                >
                                    <CalIcon size={14} />
                                    Content Plan
                                </label>
                                <select
                                    bind:value={post.content_plan_id}
                                    disabled={post.status === "published"}
                                    class="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                >
                                    <option value={null}>None</option>
                                    {#each contentPlans as cp}
                                        <option value={cp.id}
                                            >{new Date(
                                                cp.start_date,
                                            ).toLocaleDateString()} - {cp.prompt?.substring(
                                                0,
                                                20,
                                            )}...</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <!-- Publish Date -->
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                                >
                                    <CalIcon size={14} />
                                    Publish Date
                                </label>
                                <input
                                    type="date"
                                    value={post.publish_at
                                        ? post.publish_at.split("T")[0]
                                        : ""}
                                    onchange={(e) => {
                                        const current =
                                            post.publish_at ||
                                            new Date().toISOString();
                                        const timePart = current.includes("T")
                                            ? current.split("T")[1]
                                            : "00:00:00";
                                        post.publish_at = `${e.currentTarget.value}T${timePart}`;
                                    }}
                                    disabled={post.status === "published"}
                                    class="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <!-- Publish Time -->
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Clock size={14} />
                                    Publish Time
                                </label>
                                <input
                                    type="time"
                                    value={post.publish_at
                                        ? post.publish_at
                                              .split("T")[1]
                                              ?.substring(0, 5)
                                        : ""}
                                    onchange={(e) => {
                                        const current =
                                            post.publish_at ||
                                            new Date()
                                                .toISOString()
                                                .split("T")[0];
                                        const datePart = current.includes("T")
                                            ? current.split("T")[0]
                                            : current;
                                        post.publish_at = `${datePart}T${e.currentTarget.value}:00`;
                                    }}
                                    disabled={post.status === "published"}
                                    class="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="pt-6 border-t border-border space-y-4">
                        {#if post.status !== "published"}
                            <button
                                onclick={handleSave}
                                disabled={isSaving}
                                class="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                            >
                                <Save size={20} />
                                Save Everything
                            </button>

                            <button
                                class="w-full bg-green-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                onclick={() => {
                                    post.status = "approved";
                                    handleSave();
                                }}
                            >
                                <CheckCircle2 size={20} />
                                Approve Post
                            </button>
                        {:else}
                            <button
                                disabled
                                class="w-full bg-green-500 text-white py-4 rounded-2xl font-black opacity-50 cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                            >
                                <Send size={20} />
                                Published
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div
        class="flex flex-col items-center justify-center min-h-[400px] space-y-4"
    >
        <RefreshCw size={48} class="animate-spin text-primary opacity-20" />
        <p
            class="text-muted-foreground font-bold tracking-widest uppercase text-xs"
        >
            Loading Post Details...
        </p>
    </div>
{/if}
