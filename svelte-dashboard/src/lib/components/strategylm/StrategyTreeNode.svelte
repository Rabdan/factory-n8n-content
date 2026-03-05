<script lang="ts">
    import type { TreeNode } from "$lib/types/strategylm";
    import { ChevronRight, ChevronDown, Plus, Minus } from "@lucide/svelte";

    let {
        node,
        activeNodeKey,
        depth = 0,
        onSelect,
        onAddChild,
        onDeleteNode,
    } = $props<{
        node: TreeNode;
        activeNodeKey: string;
        depth?: number;
        onSelect: (node: TreeNode) => void;
        onAddChild: (node: TreeNode) => void;
        onDeleteNode: (node: TreeNode) => void;
    }>();

    let expanded = $state(true);

    const hasChildren = $derived.by(() => (node.children?.length || 0) > 0);
    const nodeKey = $derived.by(() => `${node.type}:${node.id}`);
    const isActive = $derived.by(() => activeNodeKey === nodeKey);
    const typeLabel = $derived.by(() => {
        switch (node.type) {
            case "strategy":
                return "Strategy";
            case "campaign":
                return "Campaign";
            case "plan":
                return "Content Plan";
            case "post":
                return "Post";
            default:
                return "Node";
        }
    });

    const canAddChild = $derived.by(
        () => node.type === "campaign" || node.type === "plan",
    );

    const canDelete = $derived.by(
        () => node.type === "campaign" && !!node.canDelete,
    );

    function handleSelect() {
        onSelect(node);
    }

    function toggleExpand() {
        if (!hasChildren) return;
        expanded = !expanded;
    }

    function handleAddChild(event: MouseEvent) {
        event.stopPropagation();
        onAddChild(node);
    }

    function handleDelete(event: MouseEvent) {
        event.stopPropagation();
        onDeleteNode(node);
    }
</script>

<div class="select-none">
    <div
        class="flex items-center gap-1"
        style={`padding-left: ${depth * 0.75}rem`}
    >
        {#if hasChildren}
            <button
                type="button"
                class="p-1 rounded hover:bg-muted/60 text-muted-foreground"
                onclick={toggleExpand}
            >
                {#if expanded}
                    <ChevronDown size={14} />
                {:else}
                    <ChevronRight size={14} />
                {/if}
            </button>
        {:else}
            <div class="w-6"></div>
        {/if}

        <div
            class={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/60"
            }`}
        >
            <div class="flex items-center gap-2">
                <span
                    class={`h-2 w-2 rounded-full ${node.complete ? "bg-emerald-500" : "bg-zinc-400"}`}
                ></span>
                <span class="text-[10px] text-muted-foreground">
                    ({typeLabel})
                </span>
                <span class="ml-auto flex items-center gap-1">
                    {#if canAddChild}
                        <span
                            class="inline-flex items-center justify-center rounded border border-border p-0.5 text-muted-foreground hover:bg-muted"
                            onclick={handleAddChild}
                            role="button"
                            tabindex="0"
                        >
                            <Plus size={12} />
                        </span>
                    {/if}
                </span>
            </div>
            <div class="flex items-center gap-2 pl-4">
                <button
                    type="button"
                    onclick={handleSelect}
                    class="flex-1 text-left truncate"
                >
                    {node.title}
                </button>
                {#if canDelete}
                    <span
                        class="inline-flex items-center justify-center rounded border border-border p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onclick={handleDelete}
                        role="button"
                        tabindex="0"
                    >
                        <Minus size={12} />
                    </span>
                {/if}
            </div>
        </div>
    </div>

    {#if hasChildren && expanded}
        <div class="mt-0.5 space-y-0.5 border-l border-border ml-3 pl-2">
            {#each node.children || [] as child}
                <svelte:self
                    node={child}
                    {activeNodeKey}
                    depth={depth + 1}
                    {onSelect}
                    {onAddChild}
                    {onDeleteNode}
                />
            {/each}
        </div>
    {/if}
</div>
