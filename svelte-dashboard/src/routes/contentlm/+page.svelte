<script lang="ts">
    import {
        Brain,
        Plus,
        FileText,
        Trash2,
        Send,
        Image,
        Video,
        FileAudio,
        MessageSquare,
        Wand2,
        Palette,
        Pen,
    } from "@lucide/svelte";
    import { currentProject, authFetch } from "$lib/stores";

    interface Source {
        id: string;
        name: string;
        type: "pdf" | "txt" | "doc" | "audio" | "video" | "image";
        size: string;
        uploadDate: Date;
    }

    interface Message {
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: Date;
    }

    let sources = $state<Source[]>([]);
    let messages = $state<Message[]>([
        {
            id: "1",
            role: "assistant",
            content:
                "Hi! I'm your Content LM assistant. I can help you analyze your sources and create content. Add some sources on the left to get started!",
            timestamp: new Date(),
        },
    ]);
    let chatInput = $state("");
    let isLoading = $state(false);
    let isDragging = $state(false);

    function getFileIcon(type: string) {
        switch (type) {
            case "pdf":
                return FileText;
            case "audio":
                return FileAudio;
            case "video":
                return Video;
            case "image":
                return Image;
            default:
                return FileText;
        }
    }

    function formatFileSize(size: string) {
        return size;
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        const files = e.dataTransfer?.files;
        if (files) {
            handleFiles(files);
        }
    }

    function handleFileInput(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files) {
            handleFiles(input.files);
        }
    }

    function handleFiles(files: FileList) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
            let type: Source["type"] = "txt";

            if (ext === "pdf") type = "pdf";
            else if (["mp3", "wav", "ogg"].includes(ext)) type = "audio";
            else if (["mp4", "webm"].includes(ext)) type = "video";
            else if (["jpg", "jpeg", "png", "gif"].includes(ext))
                type = "image";

            sources = [
                ...sources,
                {
                    id: crypto.randomUUID(),
                    name: file.name,
                    type,
                    size: formatFileSize((file.size / 1024).toFixed(1) + " KB"),
                    uploadDate: new Date(),
                },
            ];
        }
    }

    function removeSource(id: string) {
        sources = sources.filter((s) => s.id !== id);
    }

    async function sendMessage() {
        if (!chatInput.trim() || isLoading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: chatInput,
            timestamp: new Date(),
        };
        messages = [...messages, userMessage];
        const query = chatInput;
        chatInput = "";
        isLoading = true;

        setTimeout(() => {
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `Based on your ${sources.length} source(s), here's what I found about "${query}":\n\nI've analyzed your uploaded documents and can help you generate content. You can ask me questions about your sources or request content generation in the Studio panel.`,
                timestamp: new Date(),
            };
            messages = [...messages, assistantMessage];
            isLoading = false;
        }, 1000);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
</script>

<div class="h-screen w-screen -m-8 flex flex-col overflow-hidden w-auto">
    <div class="flex-1 flex min-h-0 overflow-hidden">
        <!-- Sources Panel - Left -->
        <div
            class="w-64 border-r border-border bg-card flex flex-col flex-shrink-0"
        >
            <div class="p-4 border-b border-border">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                    <Brain size={20} class="text-primary" />
                    Sources
                </h2>
                <p class="text-sm text-muted-foreground mt-1">
                    {sources.length} source{sources.length !== 1 ? "s" : ""} added
                </p>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
                {#if sources.length === 0}
                    <div
                        class="border-2 border-dashed border-border rounded-xl p-6 text-center transition-colors {isDragging
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground'}"
                        ondragover={handleDragOver}
                        ondragleave={handleDragLeave}
                        ondrop={handleDrop}
                        role="button"
                        tabindex="0"
                    >
                        <FileText
                            size={32}
                            class="mx-auto mb-3 text-muted-foreground"
                        />
                        <p class="text-sm font-medium mb-1">Drop files here</p>
                        <p class="text-xs text-muted-foreground mb-3">
                            or click to upload
                        </p>
                        <label class="cursor-pointer">
                            <input
                                type="file"
                                class="hidden"
                                multiple
                                accept=".pdf,.txt,.doc,.docx,.mp3,.wav,.ogg,.mp4,.webm,.jpg,.jpeg,.png,.gif"
                                onchange={handleFileInput}
                            />
                            <span
                                class="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Browse Files
                            </span>
                        </label>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each sources as source}
                            {@const Icon = getFileIcon(source.type)}
                            <div
                                class="group flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                                <div
                                    class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"
                                >
                                    <Icon size={18} class="text-primary" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium truncate">
                                        {source.name}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {source.size}
                                    </p>
                                </div>
                                <button
                                    onclick={() => removeSource(source.id)}
                                    class="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        {/each}

                        <label
                            class="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                            <input
                                type="file"
                                class="hidden"
                                multiple
                                accept=".pdf,.txt,.doc,.docx,.mp3,.wav,.ogg,.mp4,.webm,.jpg,.jpeg,.png,.gif"
                                onchange={handleFileInput}
                            />
                            <Plus size={16} class="text-muted-foreground" />
                            <span class="text-sm text-muted-foreground"
                                >Add more</span
                            >
                        </label>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Chat Panel - Center -->
        <div class="flex-1 flex flex-col bg-background min-w-0">
            <div class="p-4 border-b border-border">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare size={20} class="text-primary" />
                    Chat
                </h2>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                {#each messages as message}
                    <div
                        class="flex {message.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'}"
                    >
                        <div
                            class="flex gap-3 max-w-[80%] {message.role ===
                            'user'
                                ? 'flex-row-reverse'
                                : ''}"
                        >
                            <div
                                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 {message.role ===
                                'user'
                                    ? 'bg-primary'
                                    : 'bg-muted'}"
                            >
                                {#if message.role === "user"}
                                    <span
                                        class="text-xs font-medium text-primary-foreground"
                                        >U</span
                                    >
                                {:else}
                                    <Brain
                                        size={14}
                                        class="text-muted-foreground"
                                    />
                                {/if}
                            </div>
                            <div
                                class="p-3 rounded-xl {message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'}"
                            >
                                <p class="text-sm whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            </div>
                        </div>
                    </div>
                {/each}

                {#if isLoading}
                    <div class="flex justify-start">
                        <div class="flex gap-3 max-w-[80%]">
                            <div
                                class="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                            >
                                <Brain
                                    size={14}
                                    class="text-muted-foreground"
                                />
                            </div>
                            <div class="p-3 rounded-xl bg-muted">
                                <div class="flex gap-1">
                                    <div
                                        class="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                                        style="animation-delay: 0ms"
                                    ></div>
                                    <div
                                        class="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                                        style="animation-delay: 150ms"
                                    ></div>
                                    <div
                                        class="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                                        style="animation-delay: 300ms"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <div class="p-4 border-t border-border">
                <div class="flex gap-3">
                    <textarea
                        bind:value={chatInput}
                        onkeydown={handleKeyDown}
                        placeholder="Ask anything about your sources..."
                        class="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows="1"
                    ></textarea>
                    <button
                        onclick={sendMessage}
                        disabled={!chatInput.trim() || isLoading}
                        class="px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>

        <!-- Studio Panel - Right -->
        <div
            class="w-1/3 border-l border-border bg-card flex flex-col flex-shrink-0"
        >
            <div class="p-4 border-b border-border">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                    <Wand2 size={20} class="text-primary" />
                    Studio
                </h2>
                <p class="text-sm text-muted-foreground mt-1">
                    Generate content from your sources
                </p>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <!-- Quick Actions -->
                <div class="space-y-2">
                    <h3
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                        Actions
                    </h3>
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Pen size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Create Post</p>
                        </button>

                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Image size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Image Post</p>
                        </button>

                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Video size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Video Post</p>
                        </button>

                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Pen size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Content Plan</p>
                        </button>

                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Pen size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Calendar</p>
                        </button>

                        <button
                            class="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity text-white"
                        >
                            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Pen size={14} class="text-white" />
                            </div>
                            <p class="text-sm font-medium">Personalize</p>
                        </button>
                    </div>
                </div>

                <!-- Recent Generations -->
                <div class="space-y-2">
                    <h3
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                        Recent
                    </h3>

                    <div class="text-center py-8 text-muted-foreground">
                        <Palette size={32} class="mx-auto mb-3 opacity-50" />
                        <p class="text-sm">No generations yet</p>
                        <p class="text-xs mt-1">Create your first content</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
