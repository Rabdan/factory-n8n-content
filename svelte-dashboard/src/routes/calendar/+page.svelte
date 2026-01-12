<script lang="ts">
    import {
        ChevronLeft,
        ChevronRight,
        Check,
        CheckCheck,
        Clock,
        AlertCircle,
        Share2,
        Sparkles,
        X,
        CalendarDays,
        Plus,
        Layers,
    } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { currentProject } from "$lib/stores";
    import { goto } from "$app/navigation";

    // API base for assets
    const API_BASE = import.meta.env.VITE_API_URL || "";

    // View mode: 'week' or 'month'
    let viewMode: "week" | "month" = $state("month");

    // Current date for navigation
    let currentDate = $state(new Date());
    let posts = $state([] as any[]);
    let contentPlans = $state([] as any[]);

    async function fetchPosts() {
        if (!$currentProject) return;
        try {
            const res = await fetch(
                `/api/posts?projectId=${$currentProject.id}`,
            );
            if (res.ok) posts = await res.json();
        } catch (err) {
            console.error("Error fetching posts:", err);
        }
    }

    async function fetchContentPlans() {
        if (!$currentProject) return;
        try {
            const res = await fetch(
                `/api/projects/${$currentProject.id}/content-plans`,
            );
            if (res.ok) contentPlans = await res.json();
        } catch (err) {
            console.error("Error fetching content plans:", err);
        }
    }

    onMount(() => {
        fetchPosts();
        fetchContentPlans();
    });

    // Re-fetch posts when currentProject changes
    $effect(() => {
        if ($currentProject) {
            fetchPosts();
            fetchContentPlans();
        }
    });

    // Get week dates
    function getWeekDates(date: Date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        const monday = new Date(d.setDate(diff));

        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d);
        }
        return dates;
    }

    // Get month dates (for month view)
    function getMonthDates(date: Date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const dates = [];
        // Add padding for days before the first day of month (Monday start)
        const startPadding = (firstDay.getDay() + 6) % 7;
        for (let i = startPadding; i > 0; i--) {
            const paddingDate = new Date(year, month, 1 - i);
            dates.push({ date: paddingDate, isCurrentMonth: false });
        }

        // Add days of the month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            dates.push({
                date: new Date(year, month, i),
                isCurrentMonth: true,
            });
        }

        // Add padding for days after the last day of month
        const totalDays = dates.length;
        const endPadding = (7 - (totalDays % 7)) % 7;
        for (let i = 1; i <= endPadding; i++) {
            const paddingDate = new Date(year, month + 1, i);
            dates.push({ date: paddingDate, isCurrentMonth: false });
        }

        return dates;
    }

    function formatDate(date: Date) {
        return date.toISOString().split("T")[0];
    }

    function getPlansForDate(date: Date) {
        const dStr = formatDate(date);
        return contentPlans.filter((plan) => {
            const start = new Date(plan.start_date);
            const end = new Date(plan.end_date);
            const current = new Date(dStr);
            return current >= start && current <= end;
        });
    }

    function getPostsForDate(date: Date, networkId?: number) {
        const dateStr = formatDate(date);
        return posts.filter((p) => {
            const postDate = p.publish_at ? p.publish_at.split("T")[0] : "";
            const matchesDate = postDate === dateStr;
            const matchesNetwork = networkId
                ? p.social_network_id === networkId
                : true;
            return matchesDate && matchesNetwork;
        });
    }

    function getNetworkColor(networkId: number) {
        const network = $currentProject?.social_networks?.find(
            (n: { id: number; color?: string; name: string }) =>
                n.id === networkId,
        );
        // If explicitly colored in DB/Store
        if (network?.color) return network.color;

        // Fallback colors based on name if color not set
        const name = network?.name?.toLowerCase() || "";
        if (name.includes("instagram"))
            return "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500";
        if (name.includes("facebook")) return "bg-blue-600";
        if (name.includes("twitter") || name.includes(" x ")) return "bg-black";
        if (name.includes("linkedin")) return "bg-blue-700";

        return "bg-primary";
    }

    let weekDates = $derived(getWeekDates(new Date(currentDate)));
    let monthDates = $derived(getMonthDates(new Date(currentDate)));

    function navigate(direction: number) {
        const newDate = new Date(currentDate);
        if (viewMode === "week") {
            newDate.setDate(newDate.getDate() + direction * 7);
        } else {
            newDate.setMonth(newDate.getMonth() + direction);
        }
        currentDate = newDate;
    }

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Range Selection
    let selectedDates = $state([] as string[]);

    function toggleDateSelection(date: Date) {
        const dStr = formatDate(date);
        if (selectedDates.includes(dStr)) {
            selectedDates = selectedDates.filter((d) => d !== dStr);
        } else {
            selectedDates = [...selectedDates, dStr].sort();
        }
    }

    // Modal state for content plans
    let showPlanModal = $state(false);
    let isPlanGenerating = $state(false);
    let planGenerationProgress = $state(0);
    let planGenerationStatus = $state("");

    let newPlan = $state({
        name: "",
        prompt: "",
        platforms: [] as number[],
        color: "#3b82f6",
        start_date: "",
        end_date: "",
    });

    function openCreatePlanModal() {
        if (selectedDates.length === 0) return;
        const sorted = [...selectedDates].sort();
        newPlan.start_date = sorted[0];
        newPlan.end_date = sorted[sorted.length - 1];
        newPlan.name = `Content Plan ${sorted[0]}`;
        showPlanModal = true;
    }

    async function handleCreatePlan(startGenerate = false) {
        if (!newPlan.prompt || newPlan.platforms.length === 0) {
            alert("Fill prompt and select at least one network.");
            return;
        }

        try {
            const res = await fetch(
                `/api/projects/${$currentProject.id}/content-plans`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newPlan),
                },
            );

            if (res.ok) {
                const plan = await res.json();
                await fetchContentPlans();
                showPlanModal = false;
                selectedDates = [];

                if (startGenerate) {
                    await generatePlanContent(plan.id);
                }
            }
        } catch (err) {
            console.error("Error creating plan:", err);
        }
    }

    async function generatePlanContent(planId: number) {
        isPlanGenerating = true;
        planGenerationStatus = `Generating content for plan ${planId}...`;
        try {
            const res = await fetch(
                `/api/projects/content-plans/${planId}/generate`,
                {
                    method: "POST",
                },
            );
            if (res.ok) {
                await fetchContentPlans();
                await fetchPosts();
            }
        } catch (err) {
            console.error("Generation error:", err);
        } finally {
            isPlanGenerating = false;
        }
    }

    async function generateAllPending() {
        const pending = contentPlans.filter((p) => !p.is_generated);
        if (pending.length === 0) {
            alert("No pending plans to generate.");
            return;
        }

        isPlanGenerating = true;
        planGenerationProgress = 0;

        for (let i = 0; i < pending.length; i++) {
            const plan = pending[i];
            planGenerationStatus = `Generating: ${plan.name} (${i + 1}/${pending.length})`;
            planGenerationProgress = Math.round((i / pending.length) * 100);

            await generatePlanContent(plan.id);
            // Re-fetch posts after each generation to show progress visually
            await fetchPosts();
        }

        planGenerationProgress = 100;
        planGenerationStatus = "All plans generated!";
        setTimeout(() => {
            isPlanGenerating = false;
            planGenerationProgress = 0;
        }, 2000);
    }

    function navigateToPost(id: number) {
        goto(`/posts/${id}`);
    }

    // Selection state: Stores specific Network + Date combinations
    let selectedSlots = $state([] as { date: string; networkId: number }[]);

    function toggleSlot(date: Date, networkId: number) {
        const dStr = formatDate(date);
        const index = selectedSlots.findIndex(
            (s) => s.date === dStr && s.networkId === networkId,
        );
        if (index !== -1) {
            selectedSlots = selectedSlots.filter((_, i) => i !== index);
        } else {
            selectedSlots = [...selectedSlots, { date: dStr, networkId }];
        }
    }

    function toggleDayAll(date: Date) {
        const dStr = formatDate(date);
        const networks = $currentProject?.social_networks || [];
        const existingForDay = selectedSlots.filter((s) => s.date === dStr);

        if (existingForDay.length === networks.length && networks.length > 0) {
            // Deselect all for this day
            selectedSlots = selectedSlots.filter((s) => s.date !== dStr);
        } else {
            // Select all for this day
            const newSlots = [...selectedSlots];
            networks.forEach((n) => {
                if (
                    !newSlots.find(
                        (s) => s.date === dStr && s.networkId === n.id,
                    )
                ) {
                    newSlots.push({ date: dStr, networkId: n.id });
                }
            });
            selectedSlots = newSlots;
        }
    }

    function openGenModal() {
        const dayNamesMap = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        const networks = Array.from(
            new Set(selectedSlots.map((s) => s.networkId)),
        );
        const days = Array.from(
            new Set(
                selectedSlots.map(
                    (s) => dayNamesMap[new Date(s.date).getDay()],
                ),
            ),
        );

        if (networks.length > 0) genData.selectedNetworks = networks;
        if (days.length > 0) genData.selectedDays = days;

        showGenModal = true;
    }

    // Autogeneration state
    let showGenModal = $state(false);
    let isGenerating = $state(false);
    let progress = $state(0);
    let genStatus = $state("");
    let genData = $state({
        selectedNetworks: [] as number[],
        prompt: "",
        publishTime: "10:00",
        selectedDays: [] as string[],
    });

    const weekDayOptions = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];

    function toggleDay(day: string) {
        if (genData.selectedDays.includes(day)) {
            genData.selectedDays = genData.selectedDays.filter(
                (d) => d !== day,
            );
        } else {
            genData.selectedDays = [...genData.selectedDays, day];
        }
    }

    function toggleNetwork(id: number) {
        if (genData.selectedNetworks.includes(id)) {
            genData.selectedNetworks = genData.selectedNetworks.filter(
                (n) => n !== id,
            );
        } else {
            genData.selectedNetworks = [...genData.selectedNetworks, id];
        }
    }

    async function handleAutogenerate() {
        if (genData.selectedNetworks.length === 0 || !genData.prompt) {
            alert("Please select at least one network and provide a prompt.");
            return;
        }

        isGenerating = true;
        progress = 0;
        genStatus = "Analyzing prompt...";

        try {
            // Simulate progress for UI demonstration since backend might be fast or async
            const steps = [
                { p: 10, s: "Analyzing prompt..." },
                { p: 30, s: "Generating content ideas..." },
                { p: 50, s: "Creating visual assets..." },
                { p: 70, s: "Scheduling posts..." },
                { p: 90, s: "Finalizing..." },
                { p: 100, s: "Done!" },
            ];

            for (const step of steps) {
                await new Promise((r) => setTimeout(r, 600));
                progress = step.p;
                genStatus = step.s;
            }

            // In a real app, you'd send this to the backend
            /*
            const res = await fetch(`/api/projects/${$currentProject.id}/bulk-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(genData)
            });
            */

            await fetchPosts();
            setTimeout(() => {
                showGenModal = false;
                isGenerating = false;
            }, 500);
        } catch (err) {
            console.error("Autogeneration error:", err);
            isGenerating = false;
        }
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
            <h1 class="text-3xl font-bold tracking-tight">Content Calendar</h1>
            {#if isPlanGenerating}
                <div
                    class="flex items-center gap-3 bg-muted px-4 py-2 rounded-xl animate-pulse"
                >
                    <div
                        class="w-32 h-2 bg-primary/20 rounded-full overflow-hidden"
                    >
                        <div
                            class="h-full bg-primary"
                            style="width: {planGenerationProgress}%"
                        ></div>
                    </div>
                    <span class="text-xs font-bold truncate max-w-[150px]"
                        >{planGenerationStatus}</span
                    >
                </div>
            {/if}
        </div>

        <div class="flex items-center gap-4">
            <button
                onclick={generateAllPending}
                class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0"
            >
                <Sparkles size={18} />
                All Generate
            </button>

            {#if selectedDates.length > 0}
                <button
                    onclick={openCreatePlanModal}
                    class="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/20 hover:-translate-y-0.5 animate-in slide-in-from-right-4"
                >
                    <Plus size={18} />
                    Create Plan ({selectedDates.length})
                </button>
            {/if}

            <!-- View Toggle -->
            <div class="flex bg-muted rounded-lg p-1">
                <button
                    class="px-4 py-2 rounded-md text-sm font-medium transition-all {viewMode ===
                    'week'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground'}"
                    onclick={() => (viewMode = "week")}
                >
                    Week
                </button>
                <button
                    class="px-4 py-2 rounded-md text-sm font-medium transition-all {viewMode ===
                    'month'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground'}"
                    onclick={() => (viewMode = "month")}
                >
                    Month
                </button>
            </div>

            <!-- Navigation -->
            <div class="flex items-center gap-2">
                <button
                    class="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
                    onclick={() => navigate(-1)}
                >
                    <ChevronLeft size={20} />
                </button>
                <span class="font-bold min-w-[160px] text-center text-lg">
                    {currentDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                    })}
                </span>
                <button
                    class="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
                    onclick={() => navigate(1)}
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    </div>

    {#if viewMode === "week"}
        <!-- Week View: Rows = Social Networks, Columns = Days -->
        <div
            class="bg-card border border-border rounded-2xl overflow-hidden shadow-xl"
        >
            <div
                class="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border"
            >
                <div
                    class="p-4 font-bold text-xs text-muted-foreground uppercase tracking-wider bg-muted/30"
                >
                    Platform
                </div>
                {#each weekDates as date, i}
                    <div
                        class="p-4 text-center border-l border-border bg-muted/10"
                    >
                        <div
                            class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1"
                        >
                            {dayNames[i]}
                        </div>
                        <div class="text-xl font-black">{date.getDate()}</div>
                    </div>
                {/each}
            </div>

            {#if $currentProject?.social_networks}
                {#each $currentProject.social_networks as network}
                    <div
                        class="grid grid-cols-[180px_repeat(7,1fr)] border-b last:border-0 border-border"
                    >
                        <div
                            class="p-4 flex items-center gap-3 bg-muted/5 border-r border-border"
                        >
                            <div
                                class="w-8 h-8 rounded-lg {getNetworkColor(
                                    network.id,
                                )} flex items-center justify-center text-white shadow-sm overflow-hidden"
                            >
                                {#if network.logo_url}
                                    <img
                                        src={network.logo_url.startsWith("http")
                                            ? network.logo_url
                                            : `${API_BASE}/uploads/${network.logo_url}`}
                                        alt=""
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <Share2 size={16} />
                                {/if}
                            </div>
                            <span class="font-black text-sm truncate"
                                >{network.name}</span
                            >
                        </div>

                        {#each weekDates as date}
                            {@const dayPosts = getPostsForDate(
                                date,
                                network.id,
                            )}
                            {@const isSelected = selectedSlots.some(
                                (s) =>
                                    s.date === formatDate(date) &&
                                    s.networkId === network.id,
                            )}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                onclick={() => toggleSlot(date, network.id)}
                                class="p-2 border-r last:border-0 border-border min-h-[120px] transition-all cursor-pointer {isSelected
                                    ? 'bg-primary/10 ring-2 ring-primary ring-inset z-10'
                                    : 'bg-background/50 hover:bg-muted/5'}"
                            >
                                <div class="space-y-2">
                                    {#each dayPosts as post}
                                        <button
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                navigateToPost(post.id);
                                            }}
                                            class="w-full text-left group bg-background border border-border rounded-lg p-2 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div
                                                class="flex items-center justify-between mb-1"
                                            >
                                                <div
                                                    class="flex items-center gap-1 text-[9px] font-bold text-muted-foreground"
                                                >
                                                    <Clock size={10} />
                                                    {new Date(
                                                        post.publish_at,
                                                    ).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </div>
                                                <div
                                                    class="flex items-center gap-0.5"
                                                >
                                                    {#if post.status === "published"}
                                                        <CheckCheck
                                                            size={12}
                                                            class="text-green-500"
                                                        />
                                                    {:else if post.status === "approved"}
                                                        <Check
                                                            size={12}
                                                            class="text-green-500"
                                                        />
                                                    {/if}
                                                </div>
                                            </div>
                                            <div
                                                class="text-[11px] font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors"
                                            >
                                                {post.text_content ||
                                                    "No content..."}
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/each}
            {:else}
                <div class="p-8 text-center text-muted-foreground font-medium">
                    No social networks configured for this project.
                </div>
            {/if}
        </div>
    {:else}
        <!-- Month View -->
        <div
            class="bg-card border border-border rounded-2xl overflow-hidden shadow-xl"
        >
            <div class="grid grid-cols-7">
                {#each dayNames as day}
                    <div
                        class="p-4 text-center font-bold text-xs text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border"
                    >
                        {day}
                    </div>
                {/each}
            </div>

            <div class="grid grid-cols-7">
                {#each monthDates as { date, isCurrentMonth }}
                    {@const dayPlans = getPlansForDate(date)}
                    {@const dayPosts = getPostsForDate(date)}
                    {@const isSelected = selectedDates.includes(
                        formatDate(date),
                    )}

                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => toggleDateSelection(date)}
                        class="group relative min-h-[160px] p-3 border-r border-b border-border last:border-r-0 transition-all cursor-pointer {isSelected
                            ? 'bg-primary/5 ring-2 ring-primary ring-inset z-10'
                            : !isCurrentMonth
                              ? 'bg-muted/5 opacity-40'
                              : 'bg-background hover:bg-muted/10'}"
                    >
                        <!-- Plan Indicators (Left Bars) -->
                        <div
                            class="absolute inset-y-0 left-0 flex flex-col w-1.5 opacity-60"
                        >
                            {#each dayPlans as plan}
                                <div
                                    class="flex-1"
                                    style="background-color: {plan.color}"
                                ></div>
                            {/each}
                        </div>

                        <div class="flex justify-between items-start mb-2 pl-1">
                            <span
                                class="text-sm font-black {date.toDateString() ===
                                new Date().toDateString()
                                    ? 'bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center rounded-full -mt-1 -ml-1'
                                    : ''}"
                            >
                                {date.getDate()}
                            </span>
                        </div>

                        <!-- Plans List -->
                        <div class="flex flex-col gap-1 mb-2 ml-1">
                            {#each dayPlans as plan}
                                <div
                                    class="text-[10px] font-bold px-1.5 py-0.5 rounded border border-transparent flex items-center gap-1.5 truncate"
                                    style="background-color: {plan.color}20; color: {plan.color}; border-color: {plan.color}40"
                                >
                                    <div
                                        class="w-1.5 h-1.5 rounded-full"
                                        style="background-color: {plan.color}"
                                    ></div>
                                    <span class="truncate">{plan.name}</span>
                                </div>
                            {/each}
                        </div>

                        <!-- Posts List -->
                        <div class="space-y-1 ml-1">
                            {#each dayPosts.slice(0, 3) as post}
                                {@const net =
                                    $currentProject?.social_networks?.find(
                                        (n: {
                                            id: number;
                                            logo_url?: string;
                                        }) => n.id === post.social_network_id,
                                    )}
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        navigateToPost(post.id);
                                    }}
                                    class="w-full text-left flex items-center gap-1.5 group/post"
                                >
                                    <div class="flex-shrink-0">
                                        <div
                                            class="w-3.5 h-3.5 rounded-sm {getNetworkColor(
                                                post.social_network_id,
                                            )} flex items-center justify-center overflow-hidden"
                                        >
                                            {#if net?.logo_url}
                                                <img
                                                    src={net.logo_url.startsWith(
                                                        "http",
                                                    )
                                                        ? net.logo_url
                                                        : `${API_BASE}/uploads/${net.logo_url}`}
                                                    alt=""
                                                    class="w-full h-full object-cover"
                                                />
                                            {:else}
                                                <Share2
                                                    size={8}
                                                    class="text-white"
                                                />
                                            {/if}
                                        </div>
                                    </div>
                                    <span
                                        class="text-[10px] truncate font-medium group-hover/post:text-primary leading-tight"
                                    >
                                        {post.text_content || "Post"}
                                    </span>
                                </button>
                            {/each}
                            {#if dayPosts.length > 3}
                                <div
                                    class="text-[9px] font-bold text-muted-foreground ml-5"
                                >
                                    + {dayPosts.length - 3} more
                                </div>
                            {/if}
                        </div>

                        <!-- Tooltip -->
                        <div
                            class="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-4 rounded-2xl bg-popover border border-border shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0"
                        >
                            <h4 class="font-black text-sm mb-3">
                                {date.toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </h4>

                            {#if dayPlans.length > 0}
                                <div class="space-y-2 mb-4">
                                    <p
                                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                                    >
                                        Active Plans
                                    </p>
                                    {#each dayPlans as plan}
                                        <div
                                            class="p-2 rounded-xl border border-border bg-muted/20 flex flex-col gap-1"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <div
                                                    class="w-2 h-2 rounded-full"
                                                    style="background-color: {plan.color}"
                                                ></div>
                                                <span class="text-xs font-bold"
                                                    >{plan.name}</span
                                                >
                                            </div>
                                            <p
                                                class="text-[10px] text-muted-foreground line-clamp-2"
                                            >
                                                {plan.prompt}
                                            </p>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            {#if dayPosts.length > 0}
                                <div class="space-y-2">
                                    <p
                                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                                    >
                                        Scheduled Posts
                                    </p>
                                    {#each dayPosts as post}
                                        <div
                                            class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div
                                                class="w-2 h-2 rounded-full {getNetworkColor(
                                                    post.social_network_id,
                                                )}"
                                            ></div>
                                            <span class="text-[11px] truncate"
                                                >{post.text_content ||
                                                    "Post"}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <p
                                    class="text-[10px] text-muted-foreground italic"
                                >
                                    No posts scheduled
                                </p>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Legend -->
        <div
            class="mt-8 flex flex-wrap gap-6 p-6 bg-card border border-border rounded-2xl shadow-sm"
        >
            <div class="w-full flex items-center justify-between mb-2">
                <h3
                    class="text-xs font-black text-muted-foreground uppercase tracking-widest"
                >
                    Platforms Legend
                </h3>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <div
                            class="w-3 h-3 rounded-sm border border-border"
                        ></div>
                        <span
                            class="text-[10px] font-bold text-muted-foreground"
                            >Empty Slot</span
                        >
                    </div>
                    <div class="flex items-center gap-2">
                        <div
                            class="w-3 h-3 rounded-sm bg-primary/20 border border-primary/40"
                        ></div>
                        <span
                            class="text-[10px] font-bold text-muted-foreground"
                            >Selected Day</span
                        >
                    </div>
                </div>
            </div>
            {#if $currentProject?.social_networks}
                {#each $currentProject.social_networks as network}
                    <div
                        class="flex items-center gap-2 bg-muted/10 px-3 py-1.5 rounded-xl border border-border/50"
                    >
                        <div
                            class="w-3 h-3 rounded-full {getNetworkColor(
                                network.id,
                            )}"
                        ></div>
                        <span class="text-sm font-black">{network.name}</span>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

{#if showPlanModal}
    <!-- Modal Overlay -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
        <div
            class="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        >
            <!-- Modal Header -->
            <div
                class="p-6 border-b border-border flex items-center justify-between bg-muted/20"
            >
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary/20 rounded-xl text-primary">
                        <Plus size={24} />
                    </div>
                    <h2 class="text-2xl font-black tracking-tight">
                        Quick Create Content Plan
                    </h2>
                </div>
                <button
                    onclick={() => (showPlanModal = false)}
                    class="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label
                            class="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-auto"
                            >Plan Name</label
                        >
                        <input
                            bind:value={newPlan.name}
                            class="w-full bg-muted/30 border border-input rounded-xl p-3 font-bold"
                        />
                    </div>
                    <div class="space-y-2">
                        <label
                            class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                            >Plan Color</label
                        >
                        <div class="flex items-center gap-3">
                            <input
                                type="color"
                                bind:value={newPlan.color}
                                class="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-none p-0"
                            />
                            <span class="text-xs font-mono font-bold uppercase"
                                >{newPlan.color}</span
                            >
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label
                            class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                            >Start Date</label
                        >
                        <input
                            type="date"
                            bind:value={newPlan.start_date}
                            class="w-full bg-muted/30 border border-input rounded-xl p-3 font-bold"
                        />
                    </div>
                    <div class="space-y-2">
                        <label
                            class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                            >End Date</label
                        >
                        <input
                            type="date"
                            bind:value={newPlan.end_date}
                            class="w-full bg-muted/30 border border-input rounded-xl p-3 font-bold"
                        />
                    </div>
                </div>

                <!-- Social Networks Selection -->
                <div class="space-y-4">
                    <label
                        class="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                    >
                        <Share2 size={16} />
                        Target Platforms
                    </label>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {#if $currentProject?.social_networks}
                            {#each $currentProject.social_networks as network}
                                <button
                                    onclick={() => {
                                        if (
                                            newPlan.platforms.includes(
                                                network.id,
                                            )
                                        ) {
                                            newPlan.platforms =
                                                newPlan.platforms.filter(
                                                    (id) => id !== network.id,
                                                );
                                        } else {
                                            newPlan.platforms = [
                                                ...newPlan.platforms,
                                                network.id,
                                            ];
                                        }
                                    }}
                                    class="p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 {newPlan.platforms.includes(
                                        network.id,
                                    )
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/40'}"
                                >
                                    <div
                                        class="w-10 h-10 rounded-xl {getNetworkColor(
                                            network.id,
                                        )} flex items-center justify-center text-white shadow-md"
                                    >
                                        {#if network.logo_url}
                                            <img
                                                src={network.logo_url.startsWith(
                                                    "http",
                                                )
                                                    ? network.logo_url
                                                    : `${API_BASE}/uploads/${network.logo_url}`}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        {:else}
                                            <Share2 size={20} />
                                        {/if}
                                    </div>
                                    <span
                                        class="text-xs font-bold truncate w-full text-center"
                                        >{network.name}</span
                                    >
                                </button>
                            {/each}
                        {/if}
                    </div>
                </div>

                <!-- Prompt -->
                <div class="space-y-4">
                    <label
                        class="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"
                    >
                        <Layers size={16} />
                        Generation Prompt
                    </label>
                    <textarea
                        bind:value={newPlan.prompt}
                        placeholder="What should these posts be about?"
                        class="w-full min-h-[120px] bg-muted/30 border border-input rounded-2xl p-4 font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none shadow-inner"
                    ></textarea>
                </div>
            </div>

            <!-- Modal Footer -->
            <div
                class="p-6 bg-muted/10 border-t border-border flex justify-end gap-3"
            >
                <button
                    onclick={() => (showPlanModal = false)}
                    class="px-6 py-3 rounded-2xl font-bold hover:bg-muted transition-colors"
                >
                    Cancel
                </button>
                <button
                    onclick={() => handleCreatePlan(false)}
                    class="px-6 py-3 border-2 border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 transition-all"
                >
                    Save Plan
                </button>
                <button
                    onclick={() => handleCreatePlan(true)}
                    class="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                    Start Generate
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    :global(.line-clamp-2) {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
