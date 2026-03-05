<script lang="ts">
    import {
        Brain,
        Search,
        Plus,
        Save,
        Send,
        Paperclip,
        Link2,
    } from "@lucide/svelte";
    import { currentProject, authFetch } from "$lib/stores";
    import type {
        Strategy,
        Campaign,
        ContentPlan,
        Post,
        SourceFile,
        KnowledgeUrl,
        TreeNode,
    } from "$lib/types/strategylm";

    interface ChatMessage {
        id: string | number;
        role: "user" | "assistant";
        content: string;
        changes_summary?: string[];
        created_at?: string;
    }

    let strategies = $state<Strategy[]>([]);
    let campaigns = $state<Campaign[]>([]);
    let plans = $state<ContentPlan[]>([]);
    let posts = $state<Post[]>([]);
    let files = $state<SourceFile[]>([]);
    let urls = $state<KnowledgeUrl[]>([]);

    let search = $state("");
    let activeNode = $state<TreeNode | null>(null);
    let documentMarkdown = $state("");
    let isLoading = $state(false);
    let isSavingDoc = $state(false);

    let chatInput = $state("");
    let isAiLoading = $state(false);
    let messages = $state<ChatMessage[]>([]);

    let newUrlInput = $state("");
    let isUploading = $state(false);
    let loadedProjectId = $state<number | null>(null);

    let activeNodeKey = $derived(
        activeNode ? `${activeNode.type}:${activeNode.id}` : "",
    );

    function generateId(): string {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return (
            Math.random().toString(36).slice(2) +
            Math.random().toString(36).slice(2)
        );
    }

    function completeStrategy(item: Strategy) {
        return !!(item.document_markdown && item.document_markdown.trim());
    }

    function completeCampaign(item: Campaign) {
        return !!(item.document_markdown && item.document_markdown.trim());
    }

    function completePlan(item: ContentPlan) {
        return !!(item.document_markdown && item.document_markdown.trim());
    }

    function completePost(item: Post) {
        return !!(item.text_content && item.text_content.trim());
    }

    function strategyById(id: number) {
        return strategies.find((item) => item.id === id) || null;
    }

    function campaignById(id: number) {
        return campaigns.find((item) => item.id === id) || null;
    }

    function planById(id: number) {
        return plans.find((item) => item.id === id) || null;
    }

    function postById(id: number) {
        return posts.find((item) => item.id === id) || null;
    }

    let filteredStrategies = $derived.by(() => {
        const q = search.trim().toLowerCase();
        if (!q) return strategies;
        return strategies.filter((item) =>
            item.title.toLowerCase().includes(q),
        );
    });

    let activeContext = $derived.by(() => {
        if (!activeNode) {
            return {
                strategyId: null as number | null,
                campaignId: null as number | null,
                planId: null as number | null,
            };
        }

        if (activeNode.type === "strategy") {
            return {
                strategyId: activeNode.id,
                campaignId: null,
                planId: null,
            };
        }

        if (activeNode.type === "campaign") {
            const campaign = campaignById(activeNode.id);
            return {
                strategyId: campaign?.strategy_id || null,
                campaignId: activeNode.id,
                planId: null,
            };
        }

        if (activeNode.type === "post") {
            const post = postById(activeNode.id);
            const plan = post?.content_plan_id
                ? planById(post.content_plan_id)
                : null;
            const campaign = plan ? campaignById(plan.campaign_id) : null;
            return {
                strategyId: campaign?.strategy_id || null,
                campaignId: plan?.campaign_id || null,
                planId: plan?.id || null,
            };
        }

        const plan = planById(activeNode.id);
        const campaign = plan ? campaignById(plan.campaign_id) : null;
        return {
            strategyId: campaign?.strategy_id || null,
            campaignId: plan?.campaign_id || null,
            planId: activeNode.id,
        };
    });

    let currentStrategyId = $derived.by(() => {
        if (activeContext.strategyId) return activeContext.strategyId;
        return strategies[0]?.id || null;
    });

    let filteredCampaigns = $derived.by(() => {
        if (!currentStrategyId) return [];
        return campaigns.filter(
            (campaign) => campaign.strategy_id === currentStrategyId,
        );
    });

    let activeLinkedFiles = $derived.by(() =>
        files.filter((item) => {
            if (!activeContext.strategyId && !activeContext.campaignId)
                return false;
            const byCampaign =
                activeContext.campaignId &&
                item.campaign_id === activeContext.campaignId;
            const byStrategy =
                activeContext.strategyId &&
                item.strategy_id === activeContext.strategyId;
            return !!(byCampaign || byStrategy);
        }),
    );

    let activeLinkedUrls = $derived.by(() =>
        urls.filter((item) => {
            if (!activeContext.strategyId && !activeContext.campaignId)
                return false;
            const byCampaign =
                activeContext.campaignId &&
                item.campaign_id === activeContext.campaignId;
            const byStrategy =
                activeContext.strategyId &&
                item.strategy_id === activeContext.strategyId;
            return !!(byCampaign || byStrategy);
        }),
    );

    function escapeRegExp(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function section(md: string, heading: string) {
        const regex = new RegExp(
            `## ${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n## |$)`,
        );
        const match = md.match(regex);
        return match ? match[1].trim() : "";
    }

    function strategyToMarkdown(item: Strategy) {
        return `# ${item.title}\n\n## Brand Voice\n${item.brand_voice || ""}\n\n## Target Audience\n${item.target_audience || ""}\n\n## Core Values\n${item.core_values || ""}\n\n## Raw Data (JSON)\n\`\`\`json\n${JSON.stringify(item.raw_data_json || {}, null, 2)}\n\`\`\`\n`;
    }

    function campaignToMarkdown(item: Campaign) {
        return `# ${item.title}\n\n## Goal\n${item.goal || ""}\n\n## Main Message\n${item.main_message || ""}\n\n## Start Date\n${item.start_date || ""}\n\n## End Date\n${item.end_date || ""}\n`;
    }

    function planToMarkdown(item: ContentPlan) {
        return `# ${item.title || "Untitled Plan"}\n\n## Platform\n${item.platform || ""}\n\n## Schedule Metadata (JSON)\n\`\`\`json\n${JSON.stringify(item.schedule_metadata || {}, null, 2)}\n\`\`\`\n`;
    }

    function postToMarkdown(item: Post) {
        if (item.text_content && item.text_content.trim()) {
            return item.text_content;
        }
        return "# Untitled Post\n\n";
    }

    function toChatMessages(rows: any[]): ChatMessage[] {
        return (rows || []).map((item) => {
            let changes: string[] = [];
            if (Array.isArray(item.changes_summary)) {
                changes = item.changes_summary.map((entry: any) =>
                    String(entry),
                );
            } else if (typeof item.changes_summary === "string") {
                try {
                    const parsed = JSON.parse(item.changes_summary);
                    if (Array.isArray(parsed)) {
                        changes = parsed.map((entry: any) => String(entry));
                    }
                } catch {
                    changes = [];
                }
            }

            return {
                id: item.id || generateId(),
                role: item.role,
                content: item.content,
                changes_summary: changes,
                created_at: item.created_at,
            };
        });
    }

    async function loadBranchChatHistory(node: TreeNode) {
        if (!$currentProject?.id) return;
        const res = await authFetch(
            `/api/strategylm/chat-history?projectId=${$currentProject.id}&branchType=${node.type}&branchId=${node.id}`,
        );

        if (!res.ok) {
            messages = [
                {
                    id: generateId(),
                    role: "assistant",
                    content:
                        "StrategyLM is ready. Select a Strategy, Campaign, or Plan and I will use that context.",
                },
            ];
            return;
        }

        const rows = await res.json();
        const loaded = toChatMessages(rows);
        messages =
            loaded.length > 0
                ? loaded
                : [
                      {
                          id: generateId(),
                          role: "assistant",
                          content:
                              "StrategyLM is ready. Select a Strategy, Campaign, or Plan and I will use that context.",
                      },
                  ];
    }

    async function selectNode(node: TreeNode) {
        activeNode = node;
        if (node.type === "strategy") {
            const item = strategyById(node.id);
            documentMarkdown = item
                ? item.document_markdown || strategyToMarkdown(item)
                : "";
            await loadBranchChatHistory(node);
            return;
        }

        if (node.type === "campaign") {
            const item = campaignById(node.id);
            documentMarkdown = item
                ? item.document_markdown || campaignToMarkdown(item)
                : "";
            await loadBranchChatHistory(node);
            return;
        }

        if (node.type === "post") {
            const item = postById(node.id);
            documentMarkdown = item ? postToMarkdown(item) : "";
            await loadBranchChatHistory(node);
            return;
        }

        const item = planById(node.id);
        documentMarkdown = item
            ? item.document_markdown || planToMarkdown(item)
            : "";
        await loadBranchChatHistory(node);
    }

    async function fetchTreeAndSources() {
        if (!$currentProject?.id) return;
        isLoading = true;

        try {
            const [treeRes, sourceRes] = await Promise.all([
                authFetch(
                    `/api/strategylm/tree?projectId=${$currentProject.id}`,
                ),
                authFetch(
                    `/api/strategylm/sources?projectId=${$currentProject.id}`,
                ),
            ]);

            if (treeRes.ok) {
                const treeData = await treeRes.json();
                strategies = treeData.strategies || [];
                campaigns = treeData.campaigns || [];
                plans = treeData.plans || [];
                posts = treeData.posts || [];
            }

            if (sourceRes.ok) {
                const sourceData = await sourceRes.json();
                files = sourceData.files || [];
                urls = sourceData.urls || [];
            }

            if (!activeNode && strategies.length > 0) {
                await selectNode({
                    id: strategies[0].id,
                    type: "strategy",
                    title: strategies[0].title,
                    complete: completeStrategy(strategies[0]),
                });
            } else if (activeNode) {
                await selectNode(activeNode);
            }
        } catch (err) {
            console.error("Failed to load StrategyLM data:", err);
        } finally {
            isLoading = false;
        }
    }

    async function createStrategy() {
        if (!$currentProject?.id) return;

        const res = await authFetch("/api/strategylm/strategies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: $currentProject.id,
                title: "Untitled Strategy",
                document_markdown: null,
            }),
        });

        if (!res.ok) return;
        const created = (await res.json()) as Strategy;
        strategies = [created, ...strategies];
        await selectNode({
            id: created.id,
            type: "strategy",
            title: created.title,
            complete: completeStrategy(created),
        });
    }

    async function createCampaign(strategyId?: number) {
        const targetStrategyId = strategyId || activeContext.strategyId;
        if (!targetStrategyId) return;

        const res = await authFetch("/api/strategylm/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                strategy_id: targetStrategyId,
                title: "Untitled Campaign",
                document_markdown: null,
            }),
        });

        if (!res.ok) return;
        const created = (await res.json()) as Campaign;
        campaigns = [created, ...campaigns];
        await selectNode({
            id: created.id,
            type: "campaign",
            title: created.title,
            complete: completeCampaign(created),
        });
    }

    async function createPlan(campaignId?: number) {
        const targetCampaignId = campaignId || activeContext.campaignId;
        if (!targetCampaignId) return;

        const res = await authFetch("/api/strategylm/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                campaign_id: targetCampaignId,
                title: "Untitled Plan",
                platform: "Instagram",
                schedule_metadata: {},
                document_markdown: null,
            }),
        });

        if (!res.ok) return;
        const created = (await res.json()) as ContentPlan;
        plans = [created, ...plans];
        await selectNode({
            id: created.id,
            type: "plan",
            title: created.title || "Untitled Plan",
            complete: completePlan(created),
        });
    }

    async function deleteCampaign(node: TreeNode) {
        if (node.type !== "campaign") return;
        const res = await authFetch(`/api/strategylm/campaigns/${node.id}`, {
            method: "DELETE",
        });
        if (!res.ok) return;
        campaigns = campaigns.filter((item) => item.id !== node.id);
        if (activeNode?.type === "campaign" && activeNode.id === node.id) {
            activeNode = null;
            documentMarkdown = "";
            messages = [];
        }
    }

    function handleAddCampaign() {
        if (!currentStrategyId) return;
        createCampaign(currentStrategyId);
    }

    function parseJsonBlock(md: string, heading: string) {
        const block = section(md, heading);
        const json = block.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
        if (!json?.[1]) return {};
        try {
            return JSON.parse(json[1]);
        } catch {
            return {};
        }
    }

    async function saveDocument() {
        if (!activeNode) return;
        isSavingDoc = true;

        try {
            const title =
                documentMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
                "Untitled";

            if (activeNode.type === "strategy") {
                const payload = {
                    title,
                    brand_voice: section(documentMarkdown, "Brand Voice"),
                    target_audience: section(
                        documentMarkdown,
                        "Target Audience",
                    ),
                    core_values: section(documentMarkdown, "Core Values"),
                    document_markdown: documentMarkdown,
                    raw_data_json: parseJsonBlock(
                        documentMarkdown,
                        "Raw Data (JSON)",
                    ),
                };

                const res = await authFetch(
                    `/api/strategylm/strategies/${activeNode.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    },
                );

                if (res.ok) {
                    const updated = (await res.json()) as Strategy;
                    strategies = strategies.map((item) =>
                        item.id === updated.id ? updated : item,
                    );
                    activeNode = {
                        ...activeNode,
                        title: updated.title,
                        complete: completeStrategy(updated),
                    };
                }
            }

            if (activeNode.type === "campaign") {
                const payload = {
                    title,
                    goal: section(documentMarkdown, "Goal"),
                    main_message: section(documentMarkdown, "Main Message"),
                    document_markdown: documentMarkdown,
                    start_date: section(documentMarkdown, "Start Date") || null,
                    end_date: section(documentMarkdown, "End Date") || null,
                };

                const res = await authFetch(
                    `/api/strategylm/campaigns/${activeNode.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    },
                );

                if (res.ok) {
                    const updated = (await res.json()) as Campaign;
                    campaigns = campaigns.map((item) =>
                        item.id === updated.id ? updated : item,
                    );
                    activeNode = {
                        ...activeNode,
                        title: updated.title,
                        complete: completeCampaign(updated),
                    };
                }
            }

            if (activeNode.type === "plan") {
                const payload = {
                    title,
                    platform: section(documentMarkdown, "Platform"),
                    schedule_metadata: parseJsonBlock(
                        documentMarkdown,
                        "Schedule Metadata (JSON)",
                    ),
                    document_markdown: documentMarkdown,
                };

                const res = await authFetch(
                    `/api/strategylm/plans/${activeNode.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    },
                );

                if (res.ok) {
                    const updated = (await res.json()) as ContentPlan;
                    plans = plans.map((item) =>
                        item.id === updated.id ? updated : item,
                    );
                    activeNode = {
                        ...activeNode,
                        title: updated.title || "Untitled Plan",
                        complete: completePlan(updated),
                    };
                }
            }

            if (activeNode.type === "post") {
                const res = await authFetch(`/api/posts/${activeNode.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text_content: documentMarkdown,
                    }),
                });

                if (res.ok) {
                    const updated = (await res.json()) as Post;
                    posts = posts.map((item) =>
                        item.id === updated.id ? updated : item,
                    );
                    activeNode = {
                        ...activeNode,
                        title: updated.text_content
                            ? updated.text_content.slice(0, 32)
                            : "Untitled Post",
                        complete: completePost(updated),
                    };
                }
            }
        } catch (err) {
            console.error("Failed to save document:", err);
        } finally {
            isSavingDoc = false;
        }
    }

    async function sendMessage() {
        if (
            !chatInput.trim() ||
            isAiLoading ||
            !$currentProject?.id ||
            !activeNode
        )
            return;

        const userMsg: ChatMessage = {
            id: generateId(),
            role: "user",
            content: chatInput,
        };
        messages = [...messages, userMsg];
        const query = chatInput;
        chatInput = "";
        isAiLoading = true;

        try {
            const response = await authFetch("/api/ai/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: $currentProject.id,
                    branch_type: activeNode.type,
                    branch_id: activeNode.id,
                    document_markdown: documentMarkdown,
                    attached_documents: {
                        files: activeLinkedFiles,
                        urls: activeLinkedUrls,
                    },
                    message: query,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                documentMarkdown =
                    data.updated_document_markdown || documentMarkdown;
                if (data.updated_entity && activeNode) {
                    if (activeNode.type === "strategy") {
                        strategies = strategies.map((item) =>
                            item.id === data.updated_entity.id
                                ? data.updated_entity
                                : item,
                        );
                    } else if (activeNode.type === "campaign") {
                        campaigns = campaigns.map((item) =>
                            item.id === data.updated_entity.id
                                ? data.updated_entity
                                : item,
                        );
                    } else if (activeNode.type === "plan") {
                        plans = plans.map((item) =>
                            item.id === data.updated_entity.id
                                ? data.updated_entity
                                : item,
                        );
                    } else if (activeNode.type === "post") {
                        posts = posts.map((item) =>
                            item.id === data.updated_entity.id
                                ? data.updated_entity
                                : item,
                        );
                    }
                }
                messages = toChatMessages(data.history || []);
            } else {
                const aiMessage: ChatMessage = {
                    id: generateId(),
                    role: "assistant",
                    content: data.error || "No response",
                    changes_summary: [],
                };
                messages = [...messages, aiMessage];
            }
        } catch (err) {
            messages = [
                ...messages,
                {
                    id: generateId(),
                    role: "assistant",
                    content: "Failed to contact AI endpoint.",
                    changes_summary: [],
                },
            ];
            console.error("AI processing failed:", err);
        } finally {
            isAiLoading = false;
        }
    }

    async function handleUpload(event: Event) {
        if (!$currentProject?.id) return;

        const input = event.target as HTMLInputElement;
        const selected = input.files;
        if (!selected || selected.length === 0) return;

        isUploading = true;

        try {
            for (const file of Array.from(selected)) {
                const form = new FormData();
                form.append("file", file);
                form.append("project_id", String($currentProject.id));
                if (activeContext.strategyId)
                    form.append(
                        "strategy_id",
                        String(activeContext.strategyId),
                    );
                if (activeContext.campaignId)
                    form.append(
                        "campaign_id",
                        String(activeContext.campaignId),
                    );

                const res = await authFetch("/api/upload", {
                    method: "POST",
                    body: form,
                });

                if (res.ok) {
                    const created = (await res.json()) as SourceFile;
                    files = [created, ...files];
                }
            }
        } catch (err) {
            console.error("File upload failed:", err);
        } finally {
            input.value = "";
            isUploading = false;
        }
    }

    async function toggleFileLink(file: SourceFile) {
        if (!activeContext.strategyId && !activeContext.campaignId) return;

        const linkedToActive =
            file.campaign_id === activeContext.campaignId ||
            file.strategy_id === activeContext.strategyId;

        const res = await authFetch(
            `/api/strategylm/sources/files/${file.id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    strategy_id: linkedToActive
                        ? null
                        : activeContext.strategyId,
                    campaign_id: linkedToActive
                        ? null
                        : activeContext.campaignId,
                }),
            },
        );

        if (!res.ok) return;
        const updated = (await res.json()) as SourceFile;
        files = files.map((item) => (item.id === updated.id ? updated : item));
    }

    async function addUrl() {
        if (!newUrlInput.trim() || !$currentProject?.id) return;

        const res = await authFetch("/api/strategylm/knowledge-urls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: $currentProject.id,
                strategy_id: activeContext.strategyId,
                campaign_id: activeContext.campaignId,
                url: newUrlInput.trim(),
            }),
        });

        if (!res.ok) return;
        const created = (await res.json()) as KnowledgeUrl;
        urls = [created, ...urls];
        newUrlInput = "";
    }

    async function toggleUrlLink(item: KnowledgeUrl) {
        if (!activeContext.strategyId && !activeContext.campaignId) return;

        const linkedToActive =
            item.campaign_id === activeContext.campaignId ||
            item.strategy_id === activeContext.strategyId;

        const res = await authFetch(
            `/api/strategylm/knowledge-urls/${item.id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    strategy_id: linkedToActive
                        ? null
                        : activeContext.strategyId,
                    campaign_id: linkedToActive
                        ? null
                        : activeContext.campaignId,
                }),
            },
        );

        if (!res.ok) return;
        const updated = (await res.json()) as KnowledgeUrl;
        urls = urls.map((url) => (url.id === updated.id ? updated : url));
    }

    $effect(() => {
        if ($currentProject?.id && loadedProjectId !== $currentProject.id) {
            loadedProjectId = $currentProject.id;
            fetchTreeAndSources();
        }
    });
</script>

<div
    class="h-full min-h-0 rounded-2xl border border-border bg-card overflow-hidden"
>
    <div class="grid h-full min-h-[calc(100vh-5rem)] grid-cols-12">
        <aside
            class="col-span-3 border-r border-border bg-muted/20 flex flex-col min-h-0"
        >
            <div class="p-4 border-b border-border space-y-3">
                <div class="flex items-center justify-between">
                    <h2
                        class="text-sm font-semibold tracking-wide flex items-center gap-2"
                    >
                        <Brain size={16} class="text-primary" />
                        Strategy Navigator
                    </h2>
                    <button
                        class="p-1.5 rounded-md hover:bg-muted"
                        onclick={createStrategy}
                        title="New strategy"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                <div class="relative">
                    <Search
                        size={14}
                        class="absolute left-2.5 top-2.5 text-muted-foreground"
                    />
                    <input
                        type="text"
                        bind:value={search}
                        placeholder="Search strategies"
                        class="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div class="p-3 border-b border-border">
                <div
                    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
                >
                    Strategies
                </div>
                <div class="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {#if filteredStrategies.length === 0}
                        <p class="text-xs text-muted-foreground">
                            No strategies found.
                        </p>
                    {:else}
                        {#each filteredStrategies as strategy}
                            <button
                                class={`w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors ${activeNodeKey === `strategy:${strategy.id}` ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
                                onclick={() =>
                                    selectNode({
                                        id: strategy.id,
                                        type: "strategy",
                                        title: strategy.title,
                                        complete: completeStrategy(strategy),
                                    })}
                            >
                                {strategy.title}
                            </button>
                        {/each}
                    {/if}
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-3">
                <div
                    class="rounded-md border border-border bg-background/40 p-2"
                >
                    <div class="flex items-center gap-2">
                        <span
                            class={`h-2 w-2 rounded-full ${currentStrategyId ? "bg-emerald-500" : "bg-zinc-400"}`}
                        ></span>
                        <span class="text-[10px] text-muted-foreground">
                            (Strategy)
                        </span>
                        <button
                            class="flex-1 text-left text-sm truncate"
                            onclick={() => {
                                const strategy = strategies.find(
                                    (item) => item.id === currentStrategyId,
                                );
                                if (!strategy) return;
                                selectNode({
                                    id: strategy.id,
                                    type: "strategy",
                                    title: strategy.title,
                                    complete: completeStrategy(strategy),
                                });
                            }}
                        >
                            {strategies.find(
                                (item) => item.id === currentStrategyId,
                            )?.title || "Strategy"}
                        </button>
                    </div>

                    <div class="mt-3 border-l border-border pl-3 space-y-3">
                        <div
                            class="flex items-center justify-between text-xs tracking-wide text-muted-foreground"
                        >
                            <div class="flex items-center gap-2">
                                <span
                                    class="h-2 w-2 rounded-full bg-emerald-500"
                                ></span>
                                <span class="text-[10px] text-muted-foreground"
                                    >(Campaign)</span
                                >
                            </div>
                            <button
                                class="rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted"
                                onclick={handleAddCampaign}
                                disabled={!currentStrategyId}
                            >
                                +
                            </button>
                        </div>

                        {#if isLoading}
                            <p class="text-sm text-muted-foreground">
                                Loading hierarchy...
                            </p>
                        {:else if filteredCampaigns.length === 0}
                            <div
                                class="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                                <span class="h-2 w-2 rounded-full bg-zinc-400"
                                ></span>
                                <span>No campaign documents</span>
                            </div>
                        {:else}
                            <div class="space-y-3">
                                {#each filteredCampaigns as campaign}
                                    {@const campaignPlans = plans.filter(
                                        (plan) =>
                                            plan.campaign_id === campaign.id,
                                    )}
                                    <div
                                        class="rounded-md border border-border bg-background/60 p-2"
                                    >
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="h-2 w-2 rounded-full bg-zinc-400"
                                            ></span>

                                            <button
                                                class="flex-1 text-left text-sm truncate"
                                                onclick={() =>
                                                    selectNode({
                                                        id: campaign.id,
                                                        type: "campaign",
                                                        title: campaign.title,
                                                        complete:
                                                            completeCampaign(
                                                                campaign,
                                                            ),
                                                    })}
                                            >
                                                {campaign.title}
                                            </button>
                                        </div>

                                        <div
                                            class="mt-2 border-l border-border pl-3 space-y-2"
                                        >
                                            <div
                                                class="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground"
                                            >
                                                <span
                                                    >Content Plan / Sales Plan</span
                                                >
                                                <button
                                                    class="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                                                    onclick={() =>
                                                        createPlan(campaign.id)}
                                                >
                                                    +
                                                </button>
                                            </div>

                                            {#if campaignPlans.length === 0}
                                                <div
                                                    class="flex items-center gap-2 text-xs text-muted-foreground"
                                                >
                                                    <span
                                                        class="h-2 w-2 rounded-full bg-zinc-400"
                                                    ></span>
                                                    <span>No content plans</span
                                                    >
                                                </div>
                                            {:else}
                                                <div class="space-y-2">
                                                    {#each campaignPlans as plan}
                                                        {@const planPosts =
                                                            posts.filter(
                                                                (post) =>
                                                                    post.content_plan_id ===
                                                                    plan.id,
                                                            )}
                                                        <div>
                                                            <div
                                                                class="flex items-center gap-2"
                                                            >
                                                                <span
                                                                    class={`h-2 w-2 rounded-full ${completePlan(plan) ? "bg-emerald-500" : "bg-zinc-400"}`}
                                                                ></span>
                                                                <span
                                                                    class="text-[10px] text-muted-foreground"
                                                                >
                                                                    (Content
                                                                    Plan)
                                                                </span>
                                                                <button
                                                                    class="flex-1 text-left text-xs truncate"
                                                                    onclick={() =>
                                                                        selectNode(
                                                                            {
                                                                                id: plan.id,
                                                                                type: "plan",
                                                                                title:
                                                                                    plan.title ||
                                                                                    "Untitled Plan",
                                                                                complete:
                                                                                    completePlan(
                                                                                        plan,
                                                                                    ),
                                                                            },
                                                                        )}
                                                                >
                                                                    {plan.title ||
                                                                        "Untitled Plan"}
                                                                </button>
                                                            </div>
                                                            <div
                                                                class="mt-1 border-l border-border pl-3 space-y-1"
                                                            >
                                                                <div
                                                                    class="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground"
                                                                >
                                                                    <span
                                                                        >Posts /
                                                                        Marketing
                                                                        collateral</span
                                                                    >
                                                                    <button
                                                                        class="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                                                                        onclick={() =>
                                                                            createPost(
                                                                                plan.id,
                                                                            )}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                {#if planPosts.length === 0}
                                                                    <div
                                                                        class="flex items-center gap-2 text-xs text-muted-foreground"
                                                                    >
                                                                        <span
                                                                            class="h-2 w-2 rounded-full bg-zinc-400"
                                                                        ></span>
                                                                        <span
                                                                            >No
                                                                            posts</span
                                                                        >
                                                                    </div>
                                                                {:else}
                                                                    {#each planPosts as post}
                                                                        <div
                                                                            class="flex items-center gap-2"
                                                                        >
                                                                            <span
                                                                                class={`h-2 w-2 rounded-full ${completePost(post) ? "bg-emerald-500" : "bg-zinc-400"}`}

                                                                            ></span>
                                                                            <span
                                                                                class="text-[10px] text-muted-foreground"
                                                                            >
                                                                                (Post)
                                                                            </span>
                                                                            <button
                                                                                class="flex-1 text-left text-xs truncate"
                                                                                onclick={() =>
                                                                                    selectNode(
                                                                                        {
                                                                                            id: post.id,
                                                                                            type: "post",
                                                                                            title: post.text_content
                                                                                                ? post.text_content.slice(
                                                                                                      0,
                                                                                                      32,
                                                                                                  )
                                                                                                : "Untitled Post",
                                                                                            complete:
                                                                                                completePost(
                                                                                                    post,
                                                                                                ),
                                                                                        },
                                                                                    )}
                                                                            >
                                                                                {post.text_content
                                                                                    ? post.text_content.slice(
                                                                                          0,
                                                                                          32,
                                                                                      )
                                                                                    : "Untitled Post"}
                                                                            </button>
                                                                        </div>
                                                                    {/each}
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </aside>

        <section class="col-span-6 flex flex-col min-h-0 bg-background">
            <div
                class="p-4 border-b border-border flex items-center justify-between"
            >
                <div>
                    <h2 class="text-sm font-semibold">Document Mode</h2>
                    <p class="text-xs text-muted-foreground">
                        Markdown workspace for the active node
                    </p>
                </div>

                <button
                    class="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50"
                    onclick={saveDocument}
                    disabled={!activeNode || isSavingDoc}
                >
                    <Save size={14} />
                    {isSavingDoc ? "Saving..." : "Save"}
                </button>
            </div>

            <div class="flex-1 min-h-0 p-4 overflow-y-auto">
                {#if activeNode}
                    <textarea
                        bind:value={documentMarkdown}
                        class="w-full min-h-full rounded-lg border border-border bg-card p-4 text-sm leading-6 font-mono"
                        spellcheck="false"
                    ></textarea>
                {:else}
                    <div
                        class="h-full flex items-center justify-center text-sm text-muted-foreground"
                    >
                        Select a strategy, campaign, or plan.
                    </div>
                {/if}
            </div>

            <div class="border-t border-border bg-muted/10 p-3 space-y-3">
                <div class="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {#each messages as msg}
                        <div
                            class={`rounded-md px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary/10" : "bg-card border border-border"}`}
                        >
                            <div>{msg.content}</div>
                            {#if msg.role === "assistant" && msg.changes_summary && msg.changes_summary.length > 0}
                                <div class="mt-2 text-xs text-muted-foreground">
                                    <div
                                        class="font-semibold uppercase tracking-wide text-[10px]"
                                    >
                                        Changed
                                    </div>
                                    <div>
                                        {msg.changes_summary.join(" • ")}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                    {#if isAiLoading}
                        <div
                            class="rounded-md px-3 py-2 text-sm bg-card border border-border text-muted-foreground"
                        >
                            Thinking...
                        </div>
                    {/if}
                </div>

                <div class="flex gap-2 items-end">
                    <textarea
                        bind:value={chatInput}
                        rows="2"
                        placeholder="Ask AI to refine this document with current context"
                        class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    ></textarea>
                    <button
                        class="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                        onclick={sendMessage}
                        disabled={!activeNode ||
                            isAiLoading ||
                            !chatInput.trim()}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </section>

        <aside
            class="col-span-3 border-l border-border bg-muted/20 flex flex-col min-h-0"
        >
            <div class="p-4 border-b border-border">
                <h2 class="text-sm font-semibold">Knowledge Base</h2>
                <p class="text-xs text-muted-foreground">
                    Files and URLs linked to active strategy/campaign
                </p>
            </div>

            <div class="p-4 border-b border-border space-y-2">
                <label class="text-xs font-medium">Upload source files</label>
                <label
                    class="flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                >
                    <Paperclip size={14} />
                    <span>{isUploading ? "Uploading..." : "Select files"}</span>
                    <input
                        type="file"
                        class="hidden"
                        multiple
                        onchange={handleUpload}
                    />
                </label>

                <div class="flex gap-2">
                    <input
                        type="url"
                        bind:value={newUrlInput}
                        placeholder="https://example.com/brief"
                        class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    />
                    <button
                        class="rounded-md border border-border px-2 hover:bg-muted"
                        onclick={addUrl}
                    >
                        <Link2 size={14} />
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <h3
                        class="text-xs uppercase tracking-wide text-muted-foreground mb-2"
                    >
                        Files
                    </h3>
                    <div class="space-y-2">
                        {#each files as file}
                            {@const linked =
                                (activeContext.campaignId &&
                                    file.campaign_id ===
                                        activeContext.campaignId) ||
                                (activeContext.strategyId &&
                                    file.strategy_id ===
                                        activeContext.strategyId)}
                            <button
                                class={`w-full text-left rounded-md border px-2.5 py-2 text-xs transition-colors ${linked ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-card hover:bg-muted"}`}
                                onclick={() => toggleFileLink(file)}
                            >
                                <div class="font-medium truncate">
                                    {file.filename}
                                </div>
                                <div class="text-[11px] text-muted-foreground">
                                    {linked
                                        ? "Linked to active context"
                                        : "Not linked"}
                                </div>
                            </button>
                        {/each}
                        {#if files.length === 0}
                            <p class="text-xs text-muted-foreground">
                                No files uploaded.
                            </p>
                        {/if}
                    </div>
                </div>

                <div>
                    <h3
                        class="text-xs uppercase tracking-wide text-muted-foreground mb-2"
                    >
                        URLs
                    </h3>
                    <div class="space-y-2">
                        {#each urls as item}
                            {@const linked =
                                (activeContext.campaignId &&
                                    item.campaign_id ===
                                        activeContext.campaignId) ||
                                (activeContext.strategyId &&
                                    item.strategy_id ===
                                        activeContext.strategyId)}
                            <button
                                class={`w-full text-left rounded-md border px-2.5 py-2 text-xs transition-colors ${linked ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-card hover:bg-muted"}`}
                                onclick={() => toggleUrlLink(item)}
                            >
                                <div class="font-medium truncate">
                                    {item.title || item.url}
                                </div>
                                <div
                                    class="text-[11px] text-muted-foreground truncate"
                                >
                                    {item.url}
                                </div>
                            </button>
                        {/each}
                        {#if urls.length === 0}
                            <p class="text-xs text-muted-foreground">
                                No URLs saved.
                            </p>
                        {/if}
                    </div>
                </div>
            </div>
        </aside>
    </div>
</div>
