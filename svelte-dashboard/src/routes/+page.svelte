<script lang="ts">
    import { BarChart3, TrendingUp, Users, FileText, Calendar, Clock } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { currentProject } from "$lib/stores";

    const API_BASE = import.meta.env.VITE_API_URL || "";

    let posts = $state([]);
    let teamMembers = $state([]);
    let isLoading = $state(true);

// Reactive state for computed values
    let totalPosts = $state(0);
    let publishedPosts = $state(0);
    let publishRate = $state(0);
    let thisWeekPosts = $state(0);

    // Update computed values when posts change
    $effect(() => {
        totalPosts = posts.length;
        publishedPosts = posts.filter(p => p.status === 'published').length;
        
        const total = totalPosts;
        const published = publishedPosts;
        publishRate = total > 0 ? Math.round((published / total) * 100) : 0;
        
        thisWeekPosts = posts.filter(p => {
            const postDate = new Date(p.publish_at);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() -7);
            return postDate >= oneWeekAgo;
        }).length;
    });

    async function fetchDashboardData() {
        if (!$currentProject) return;

        try {
            // Fetch posts
            const postsUrl = `/api/posts?projectId=${$currentProject.id}`;
            console.log('Fetching posts from:', postsUrl);
            
            const postsRes = await fetch(postsUrl);
            if (postsRes.ok) {
                posts = await postsRes.json();
                console.log('Posts loaded:', posts.length);
            } else {
                console.error('Posts fetch failed:', postsRes.status, postsRes.statusText);
            }

            // Fetch team members (using project details)
            const projectUrl = `/api/projects/${$currentProject.id}`;
            console.log('Fetching project from:', projectUrl);
            
            const projectRes = await fetch(projectUrl);
            if (projectRes.ok) {
                const project = await projectRes.json();
                teamMembers = project.members || [];
                console.log('Team members loaded:', teamMembers.length);
            } else {
                console.error('Project fetch failed:', projectRes.status, projectRes.statusText);
            }
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            isLoading = false;
        }
    }

    function formatTimeAgo(dateString: string) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    function getActivityStatus(post: any) {
        switch (post.status) {
            case 'published':
                return 'success';
            case 'approved':
                return 'info';
            case 'draft':
                return 'pending';
            default:
                return 'info';
        }
    }

    function getActivityAction(post: any) {
        const platform = post.social_network_name || 'Unknown';
        switch (post.status) {
            case 'published':
                return `Post published on ${platform}`;
            case 'approved':
                return `Post approved for ${platform}`;
            case 'draft':
                return `Post scheduled for ${platform}`;
            default:
                return `Content generated for ${platform}`;
        }
    }

    // Get recent activity from posts
    const recentActivity = $derived(() => posts
        .sort((a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime())
        .slice(0, 10)
        .map(post => ({
            action: getActivityAction(post),
            platform: post.social_network_name || 'Unknown',
            time: formatTimeAgo(post.publish_at),
            status: getActivityStatus(post)
        })));

    onMount(() => {
        fetchDashboardData();
    });

    $effect(() => {
        if ($currentProject) {
            fetchDashboardData();
        }
    });
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p class="text-muted-foreground mt-1">
            Welcome to your Content Factory. Manage your social media content
            efficiently.
        </p>
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    {:else}
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
                class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-muted-foreground">Total Posts</p>
                        <p class="text-3xl font-bold mt-1">{totalPosts}</p>
                    </div>
                    <div
                        class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"
                    >
                        <FileText class="text-primary" size={24} />
                    </div>
                </div>
                <p class="text-xs text-muted-foreground mt-3">+{thisWeekPosts} this week</p>
            </div>

            <div
                class="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-muted-foreground">Published</p>
                        <p class="text-3xl font-bold mt-1">{publishedPosts}</p>
                    </div>
                    <div
                        class="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center"
                    >
                        <TrendingUp class="text-green-500" size={24} />
                    </div>
                </div>
                <p class="text-xs text-muted-foreground mt-3">{publishRate}% publish rate</p>
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
                        <p class="text-3xl font-bold mt-1">{teamMembers.length}</p>
                    </div>
                    <div
                        class="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center"
                    >
                        <Users class="text-purple-500" size={24} />
                    </div>
                </div>
                <p class="text-xs text-muted-foreground mt-3">Active team</p>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
            {#if recentActivity.length > 0}
                <div class="space-y-4">
                    {#each recentActivity as activity}
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
            {:else}
                <div class="text-center py-8 text-muted-foreground">
                    <Calendar size={48} class="mx-auto mb-4 opacity-50" />
                    <p>No recent activity</p>
                    <p class="text-sm">Start creating content to see activity here</p>
                </div>
            {/if}
        </div>
    {/if}
</div>
