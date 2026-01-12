<script lang="ts">
    import {
        BarChart3,
        TrendingUp,
        TrendingDown,
        Users,
        Eye,
        Heart,
        MessageCircle,
    } from "@lucide/svelte";
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">Analytics</h1>
        <p class="text-muted-foreground mt-1">
            Track your content performance across platforms.
        </p>
    </div>

    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-card border border-border rounded-xl p-6">
            <div class="flex items-center gap-2 text-muted-foreground mb-2">
                <Eye size={18} />
                <span class="text-sm">Total Reach</span>
            </div>
            <div class="text-3xl font-bold">45.2K</div>
            <div class="flex items-center gap-1 text-green-500 text-sm mt-2">
                <TrendingUp size={16} />
                <span>+12.5%</span>
            </div>
        </div>

        <div class="bg-card border border-border rounded-xl p-6">
            <div class="flex items-center gap-2 text-muted-foreground mb-2">
                <Heart size={18} />
                <span class="text-sm">Engagements</span>
            </div>
            <div class="text-3xl font-bold">8,432</div>
            <div class="flex items-center gap-1 text-green-500 text-sm mt-2">
                <TrendingUp size={16} />
                <span>+8.3%</span>
            </div>
        </div>

        <div class="bg-card border border-border rounded-xl p-6">
            <div class="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageCircle size={18} />
                <span class="text-sm">Comments</span>
            </div>
            <div class="text-3xl font-bold">1,234</div>
            <div class="flex items-center gap-1 text-red-500 text-sm mt-2">
                <TrendingDown size={16} />
                <span>-2.1%</span>
            </div>
        </div>

        <div class="bg-card border border-border rounded-xl p-6">
            <div class="flex items-center gap-2 text-muted-foreground mb-2">
                <Users size={18} />
                <span class="text-sm">New Followers</span>
            </div>
            <div class="text-3xl font-bold">523</div>
            <div class="flex items-center gap-1 text-green-500 text-sm mt-2">
                <TrendingUp size={16} />
                <span>+18.7%</span>
            </div>
        </div>
    </div>

    <!-- Platform Performance -->
    <div class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-xl font-semibold mb-6">Platform Performance</h2>

        <div class="space-y-4">
            {#each [{ name: "Instagram", reach: 18500, engagement: 4.2, color: "bg-pink-500", progress: 85 }, { name: "Facebook", reach: 12300, engagement: 3.1, color: "bg-blue-600", progress: 65 }, { name: "Twitter", reach: 8900, engagement: 2.8, color: "bg-sky-500", progress: 50 }, { name: "LinkedIn", reach: 5500, engagement: 5.1, color: "bg-blue-700", progress: 40 }] as platform}
                <div class="flex items-center gap-4">
                    <div class="w-24 flex items-center gap-2">
                        <div
                            class="w-3 h-3 rounded-full {platform.color}"
                        ></div>
                        <span class="text-sm font-medium">{platform.name}</span>
                    </div>
                    <div class="flex-1">
                        <div class="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                class="h-full {platform.color} rounded-full transition-all"
                                style="width: {platform.progress}%"
                            ></div>
                        </div>
                    </div>
                    <div class="w-20 text-right text-sm text-muted-foreground">
                        {platform.reach.toLocaleString()}
                    </div>
                    <div class="w-16 text-right text-sm font-medium">
                        {platform.engagement}%
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- Chart Placeholder -->
    <div class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-xl font-semibold mb-6">Engagement Over Time</h2>
        <div
            class="h-64 flex items-center justify-center bg-muted/20 rounded-lg border border-dashed border-border"
        >
            <div class="text-center text-muted-foreground">
                <BarChart3 size={48} class="mx-auto mb-2 opacity-50" />
                <p>Chart visualization coming soon</p>
            </div>
        </div>
    </div>
</div>
