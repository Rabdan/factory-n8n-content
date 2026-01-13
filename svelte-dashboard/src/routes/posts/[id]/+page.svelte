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
        class="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button
                    onclick={() => history.back()}
                    class="p-1.5 hover:bg-muted rounded-md transition-colors border border-border"
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-xl font-bold tracking-tight">
                            Edit Post
                        </h1>
                        <span
                            class="px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider {getStatusBadgeClass(
                                post.status,
                            )}"
                        >
                            {post.status}
                        </span>
                    </div>
                    <p
                        class="text-muted-foreground text-[10px] font-semibold uppercase tracking-tight opacity-70"
                    >
                        {post.social_network_name || "Platform Unassigned"} • ID
                        #{post.id}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-2">
                {#if post.status !== "published"}
                    <button
                        onclick={handleSave}
                        disabled={isSaving}
                        class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {#if isSaving}
                            <RefreshCw size={14} class="animate-spin" />
                            Saving...
                        {:else}
                            <Save size={14} />
                            Save
                        {/if}
                    </button>
                {:else}
                    <div
                        class="flex items-center gap-2 text-green-600 font-bold text-sm px-3 py-1 bg-green-500/5 rounded-lg border border-green-500/20"
                    >
                        <CheckCircle2 size={14} />
                        Published
                    </div>
                {/if}
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Main Content -->
            <div class="lg:col-span-8 space-y-6">
                <!-- Visual Content Section -->
                <div
                    class="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                    <div
                        class="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20"
                    >
                        <h2
                            class="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <ImageIcon size={14} class="text-primary" />
                            Visual Content
                        </h2>
                        {#if post.status !== "published"}
                            <button
                                onclick={() => handleRegenerate("image")}
                                disabled={isRegenerating}
                                class="text-[10px] font-bold flex items-center gap-1.5 text-primary hover:bg-primary/5 px-2 py-1 rounded transition-colors disabled:opacity-50"
                            >
                                <Sparkles size={12} />
                                Regenerate Images
                            </button>
                        {/if}
                    </div>
                    <div class="p-5">
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {#if post.media_files && post.media_files.length > 0}
                                {#each post.media_files as media, i}
                                    <div
                                        class="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/20 shadow-inner"
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
                                                class="bg-white/20 backdrop-blur-sm p-1.5 rounded-md hover:bg-white/30 transition-colors"
                                            >
                                                <RefreshCw
                                                    size={16}
                                                    class="text-white"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            {:else}
                                <div
                                    class="col-span-full aspect-[3/1] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/5 p-6"
                                >
                                    <ImageIcon
                                        size={32}
                                        class="mb-2 opacity-20"
                                    />
                                    <p class="font-bold text-sm opacity-40">
                                        No images generated
                                    </p>
                                    <p class="text-[10px] opacity-30 mt-1">
                                        Trigger regeneration to create visuals
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Post Text Section -->
                <div
                    class="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col"
                >
                    <div
                        class="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20"
                    >
                        <h2
                            class="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                        >
                            <Type size={14} class="text-primary" />
                            Post Text
                        </h2>
                        {#if post.status !== "published"}
                            <button
                                onclick={() => handleRegenerate("text")}
                                disabled={isRegenerating}
                                class="text-[10px] font-bold flex items-center gap-1.5 text-primary hover:bg-primary/5 px-2 py-1 rounded transition-colors disabled:opacity-50"
                            >
                                <Sparkles size={12} />
                                Regenerate Text
                            </button>
                        {/if}
                    </div>
                    <div class="p-5 space-y-5">
                        <textarea
                            bind:value={post.text_content}
                            disabled={post.status === "published"}
                            class="w-full min-h-[400px] bg-background border border-input rounded-lg p-4 text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none shadow-inner disabled:opacity-70"
                            placeholder="Write your content here..."
                        ></textarea>

                        <div class="space-y-2">
                            <label
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"
                            >
                                <Hash size={12} />
                                Tags
                            </label>
                            <div class="flex flex-wrap gap-1.5">
                                {#each post.tags as tag, i}
                                    <div
                                        class="flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded text-[11px] font-bold"
                                    >
                                        #{tag}
                                        {#if post.status !== "published"}
                                            <button
                                                onclick={() => removeTag(i)}
                                                class="hover:text-destructive transition-colors ml-0.5"
                                            >
                                                <X size={10} />
                                            </button>
                                        {/if}
                                    </div>
                                {/each}
                                {#if post.status !== "published"}
                                    <button
                                        onclick={addTag}
                                        class="flex items-center gap-1 border border-dashed border-border px-2 py-0.5 rounded text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-primary transition-all"
                                    >
                                        <Plus size={10} />
                                        Add Tag
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-4 space-y-6">
                <div
                    class="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6 sticky top-6"
                >
                    <h3
                        class="text-xs font-bold uppercase tracking-widest border-b border-border pb-3 flex items-center gap-2"
                    >
                        <Layers size={14} class="text-primary" />
                        Settings
                    </h3>

                    <div class="space-y-4">
                        <!-- Social Network -->
                        <div class="space-y-1.5">
                            <label
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                            >
                                Platform
                            </label>
                            <select
                                bind:value={post.social_network_id}
                                disabled={post.status === "published"}
                                class="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                            >
                                {#if $currentProject?.social_networks}
                                    {#each $currentProject.social_networks as sn}
                                        <option value={sn.id}>{sn.name}</option>
                                    {/each}
                                {/if}
                            </select>
                        </div>

                        <!-- Content Plan -->
                        <div class="space-y-1.5">
                            <label
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                            >
                                Content Plan
                            </label>
                            <select
                                bind:value={post.content_plan_id}
                                disabled={post.status === "published"}
                                class="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                            >
                                <option value={null}>None</option>
                                {#each contentPlans as cp}
                                    <option value={cp.id}>
                                        {new Date(
                                            cp.start_date,
                                        ).toLocaleDateString()} - {cp.name ||
                                            "Untitled"}
                                    </option>
                                {/each}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="space-y-1.5">
                                <label
                                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                                >
                                    Date
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
                                    class="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <label
                                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                                >
                                    Time
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
                                    class="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="pt-6 border-t border-border space-y-2">
                        {#if post.status !== "published"}
                            <button
                                onclick={handleSave}
                                disabled={isSaving}
                                class="w-full bg-primary text-primary-foreground py-2 rounded-lg font-bold text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                Save Post
                            </button>

                            <button
                                class="w-full bg-green-600 text-white py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                onclick={() => {
                                    post.status = "approved";
                                    handleSave();
                                }}
                            >
                                <CheckCircle2 size={16} />
                                Approve
                            </button>
                        {:else}
                            <button
                                disabled
                                class="w-full bg-green-600 text-white py-2 rounded-lg font-bold text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
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
