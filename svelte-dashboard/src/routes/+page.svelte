<script lang="ts">
    import { BarChart3, TrendingUp, Users, FileText } from "@lucide/svelte";
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p class="text-muted-foreground mt-1">
            Welcome to your Content Factory. Manage your social media content
            efficiently.
        </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
            class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-muted-foreground">Total Posts</p>
                    <p class="text-3xl font-bold mt-1">124</p>
                </div>
                <div
                    class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"
                >
                    <FileText class="text-primary" size={24} />
                </div>
            </div>
            <p class="text-xs text-muted-foreground mt-3">+12 this week</p>
        </div>

        <div
            class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-muted-foreground">Published</p>
                    <p class="text-3xl font-bold mt-1">89</p>
                </div>
                <div
                    class="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center"
                >
                    <TrendingUp class="text-green-500" size={24} />
                </div>
            </div>
            <p class="text-xs text-muted-foreground mt-3">72% publish rate</p>
        </div>

        <div
            class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-muted-foreground">Engagement</p>
                    <p class="text-3xl font-bold mt-1">2.4K</p>
                </div>
                <div
                    class="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center"
                >
                    <BarChart3 class="text-blue-500" size={24} />
                </div>
            </div>
            <p class="text-xs text-muted-foreground mt-3">
                +18% from last month
            </p>
        </div>

        <div
            class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-muted-foreground">Team Members</p>
                    <p class="text-3xl font-bold mt-1">5</p>
                </div>
                <div
                    class="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center"
                >
                    <Users class="text-purple-500" size={24} />
                </div>
            </div>
            <p class="text-xs text-muted-foreground mt-3">2 pending invites</p>
        </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
        <div class="space-y-4">
            {#each [{ action: "Post published", platform: "Instagram", time: "2 hours ago", status: "success" }, { action: "Post scheduled", platform: "Facebook", time: "4 hours ago", status: "pending" }, { action: "Content generated", platform: "Twitter", time: "5 hours ago", status: "info" }, { action: "Post approved", platform: "LinkedIn", time: "1 day ago", status: "success" }] as activity}
                <div
                    class="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="w-2 h-2 rounded-full {activity.status ===
                            'success'
                                ? 'bg-green-500'
                                : activity.status === 'pending'
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-500'}"
                        ></div>
                        <div>
                            <p class="font-medium text-sm">{activity.action}</p>
                            <p class="text-xs text-muted-foreground">
                                {activity.platform}
                            </p>
                        </div>
                    </div>
                    <span class="text-xs text-muted-foreground"
                        >{activity.time}</span
                    >
                </div>
            {/each}
        </div>
    </div>
</div>
