<script lang="ts">
    import {
        Upload,
        FileText,
        Image,
        Film,
        Trash2,
        Download,
    } from "@lucide/svelte";

    // Mock files data
    const files = [
        {
            id: 1,
            name: "brand-guidelines.pdf",
            type: "document",
            size: "2.4 MB",
            uploadedAt: "2026-01-10",
        },
        {
            id: 2,
            name: "product-photo-1.jpg",
            type: "image",
            size: "1.2 MB",
            uploadedAt: "2026-01-09",
        },
        {
            id: 3,
            name: "promo-video.mp4",
            type: "video",
            size: "15.8 MB",
            uploadedAt: "2026-01-08",
        },
        {
            id: 4,
            name: "content-ideas.docx",
            type: "document",
            size: "156 KB",
            uploadedAt: "2026-01-07",
        },
        {
            id: 5,
            name: "team-photo.png",
            type: "image",
            size: "3.1 MB",
            uploadedAt: "2026-01-06",
        },
    ];

    function getFileIcon(type: string) {
        switch (type) {
            case "image":
                return Image;
            case "video":
                return Film;
            default:
                return FileText;
        }
    }

    function getFileColor(type: string) {
        switch (type) {
            case "image":
                return "text-green-500 bg-green-500/10";
            case "video":
                return "text-purple-500 bg-purple-500/10";
            default:
                return "text-blue-500 bg-blue-500/10";
        }
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">Files & Resources</h1>
            <p class="text-muted-foreground mt-1">
                Upload documents and images for RAG and content generation.
            </p>
        </div>

        <button
            class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
            <Upload size={18} />
            Upload Files
        </button>
    </div>

    <!-- Upload Zone -->
    <div
        class="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
    >
        <Upload size={48} class="mx-auto mb-4 text-muted-foreground" />
        <h3 class="text-lg font-medium mb-2">
            Drop files here or click to upload
        </h3>
        <p class="text-sm text-muted-foreground">
            Supports PDF, DOC, DOCX, JPG, PNG, MP4 (Max 50MB)
        </p>
    </div>

    <!-- Files List -->
    <div class="bg-card border border-border rounded-xl overflow-hidden">
        <div
            class="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/50 text-sm font-medium text-muted-foreground"
        >
            <div class="col-span-6">Name</div>
            <div class="col-span-2">Type</div>
            <div class="col-span-2">Size</div>
            <div class="col-span-2">Actions</div>
        </div>

        {#each files as file}
            {@const IconComponent = getFileIcon(file.type)}
            <div
                class="grid grid-cols-12 gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors items-center"
            >
                <div class="col-span-6 flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center {getFileColor(
                            file.type,
                        )}"
                    >
                        <IconComponent size={20} />
                    </div>
                    <div>
                        <p class="font-medium text-sm">{file.name}</p>
                        <p class="text-xs text-muted-foreground">
                            {file.uploadedAt}
                        </p>
                    </div>
                </div>
                <div
                    class="col-span-2 capitalize text-sm text-muted-foreground"
                >
                    {file.type}
                </div>
                <div class="col-span-2 text-sm text-muted-foreground">
                    {file.size}
                </div>
                <div class="col-span-2 flex items-center gap-2">
                    <button
                        class="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Download"
                    >
                        <Download size={16} class="text-muted-foreground" />
                    </button>
                    <button
                        class="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} class="text-destructive" />
                    </button>
                </div>
            </div>
        {/each}
    </div>
</div>
