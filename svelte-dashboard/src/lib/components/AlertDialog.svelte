<script lang="ts">
    import { X } from "@lucide/svelte";

    let {
        title = "Confirm",
        description = "Are you sure?",
        confirmText = "OK",
        variant = "default" as "default" | "destructive",
        open = $bindable(false),
        onConfirm,
    } = $props();

    function handleConfirm() {
        open = false;
        onConfirm?.();
    }

    function handleCancel() {
        open = false;
    }

    function handleOverlayClick() {
        open = false;
    }

    function handleOverlayKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            handleOverlayClick();
        }
    }

    function show() {
        open = true;
    }

    // Expose show method to parent
    export { show };

    let dialogRef = $state<HTMLDivElement>();

    // Handle escape key
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            open = false;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
<!-- Overlay -->
        <button 
            class="absolute inset-0 bg-black/50 animate-fade-in cursor-default"
            onclick={handleOverlayClick}
            onkeydown={handleOverlayKeydown}
            aria-label="Close dialog"
            type="button"
        ></button>

        <!-- Dialog -->
        <div
            bind:this={dialogRef}
            class="relative bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
        >
            <!-- Header -->
            <div class="flex justify-between items-center mb-4">
                <h3 id="dialog-title" class="text-lg font-semibold">
                    {title}
                </h3>
                <button
                    onclick={handleCancel}
                    class="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-1"
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
            </div>

            <!-- Description -->
            <p
                id="dialog-description"
                class="text-sm text-muted-foreground mb-6"
            >
                {description}
            </p>

            <!-- Actions -->
            <div class="flex justify-end">
                <button
                    onclick={handleConfirm}
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 {variant ===
                    'destructive'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'}"
                >
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes scale-in {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }

    .animate-fade-in {
        animation: fade-in 0.2s ease-out;
    }

    .animate-scale-in {
        animation: scale-in 0.2s ease-out;
    }
</style>
