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
    import { toDateKey } from "$lib/utils/date";
    import DatePicker from "$lib/components/DatePicker.svelte";
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
            if (res.ok) {
                contentPlans = await res.json();
            }
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
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        const formattedDate = `${year}-${month}-${day}`;
        return formattedDate;
    }

    function getPlansForDate(date: Date) {
        const dStr = formatDate(date);
        const plans = contentPlans.filter((plan) => {
            const planDates = plan.dates || [];
            return planDates.includes(dStr);
        });
        return plans;
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
    let isEditingPlan = $state(false);
    let isPlanGenerating = $state(false);
    let planGenerationProgress = $state(0);
    let planGenerationStatus = $state("");

    function isPast(dateString: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 1); // Set to start of day for accurate comparison
        return new Date(dateString) < today;
    }

    const PLAN_COLORS = [
        "#3b82f6", // Blue
        "#10b981", // Emerald
        "#f59e0b", // Amber
        "#ef4444", // Red
        "#8b5cf6", // Violet
    ];

    function getNextPlanColor() {
        return PLAN_COLORS[contentPlans.length % PLAN_COLORS.length];
    }

    function updatePlanPrompt() {
        if (!$currentProject?.social_networks) return;
        const selectedNets = $currentProject.social_networks.filter((n: any) =>
            newPlan.platforms.some((p) => p.id === n.id),
        );
        if (selectedNets.length === 0) {
            newPlan.prompt = "";
            return;
        }
        newPlan.prompt = selectedNets
            .map(
                (n: any) =>
                    `[${n.name} Settings]:\n${n.default_prompt || "Default generation rules apply."}`,
            )
            .join("\n\n");
    }

    let newPlan = $state({
        name: "",
        prompt: "",
        platforms: [] as Array<{ id: number; publishTime: string }>,
        color: "#3b82f6",
        dates: [] as string[],
        create: "new",
    });

    function openEditPlanModal(plan: any) {
        isEditingPlan = true;

        // Convert old platform format to new format if needed
        let platforms = plan.platforms || [];
        if (platforms.length > 0 && typeof platforms[0] === "number") {
            platforms = platforms.map((platformId: number) => ({
                id: platformId,
                publishTime:
                    $currentProject?.social_networks?.find(
                        (n) => n.id === platformId,
                    )?.default_publish_time || "10:00:00",
            }));
        }

        newPlan = {
            ...plan,
            platforms,
            dates: plan.dates || [],
            create: "update",
        };
        selectedDates = [];
        showPlanModal = true;
    }

    function openCreatePlanModal() {
        if (selectedDates.length === 0) return;
        newPlan.dates = [...selectedDates].sort();
        newPlan.name = "";
        newPlan.color = getNextPlanColor();
        // Initialize platforms with default times from social_networks
        newPlan.platforms =
            $currentProject?.social_networks?.map((network) => ({
                id: network.id,
                publishTime: network.default_publish_time || "10:00:00",
            })) || [];
        newPlan.prompt = "";
        newPlan.create = "new";
        showPlanModal = true;
    }

    function addPlanDate(date: string) {
        if (!newPlan.dates.includes(date)) {
            newPlan.dates = [...newPlan.dates, date].sort();
        }
    }

    function removePlanDate(date: string) {
        newPlan.dates = newPlan.dates.filter((d) => d !== date);
    }

    function updatePlatformPublishTime(networkId: number, time: string) {
        newPlan.platforms = newPlan.platforms.map((p) =>
            p.id === networkId ? { ...p, publishTime: time } : p,
        );
    }

    async function handleCreatePlan(startGenerate = false) {
        if (!newPlan.prompt || newPlan.platforms.length === 0) {
            alert(
                "Fill prompt, select at least one network, and choose dates.",
            );
            return;
        }

        if (newPlan.dates.length === 0 && newPlan.create === "new") {
            alert(
                "Fill prompt, select at least one network, and choose dates.",
            );
            return;
        }

        const planData = {
            id: newPlan.create == "new" ? 0 : newPlan.id,
            name: newPlan.name,
            prompt: newPlan.prompt,
            dates: newPlan.dates,
            platforms: newPlan.platforms.map((p) => ({
                id: p.id,
                publishTime: p.publishTime,
            })),
            color: newPlan.color,
        };

        try {
            const res = await fetch(
                `/api/projects/${$currentProject.id}/content-plans`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(planData),
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
    let showDatePicker = $state(false);
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

    let genError = $state("");

    async function handleAutogenerate() {
        if (genData.selectedNetworks.length === 0 || !genData.prompt) {
            genError =
                "Please select at least one network and provide a prompt.";
            return;
        }

        genError = "";
        isGenerating = true;
        progress = 0;
        genStatus = "Analyzing prompt...";

        try {
            const steps = [
                { p: 10, s: "Analyzing prompt..." },
                { p: 30, s: "Generating content ideas..." },
                { p: 50, s: "Creating visual assets..." },
                { p: 70, s: "Scheduling posts..." },
                { p: 90, s: "Finalizing..." },
                { p: 100, s: "Done!" },
            ];

            // Simulate progress for UI demonstration
            for (const step of steps) {
                await new Promise((r) => setTimeout(r, 600));
                progress = step.p;
                genStatus = step.s;
            }

            // Send to backend
            const res = await fetch(
                `/api/projects/${$currentProject.id}/bulk-generate`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        networks: genData.selectedNetworks,
                        prompt: genData.prompt,
                        publishTime: genData.publishTime,
                        days: genData.selectedDays,
                    }),
                },
            );

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Generation failed");
            }

            await fetchPosts();
            setTimeout(() => {
                showGenModal = false;
                isGenerating = false;
                genError = "";
            }, 500);
        } catch (err) {
            console.error("Autogeneration error:", err);
            genError =
                err instanceof Error
                    ? err.message
                    : "Failed to generate content. Please try again.";
            isGenerating = false;
        }
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
            <h1 class="text-3xl font-bold tracking-tight">Content Planner</h1>
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

        <div class="flex items-center gap-2">
            <div class="relative group">
                <button
                    onclick={openCreatePlanModal}
                    disabled={selectedDates.length === 0}
                    class="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow hover:bg-green-700 active:scale-95 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
                >
                    <Plus size={16} />
                    Campaigns {#if selectedDates.length > 0}({selectedDates.length}){/if}
                </button>
                <div
                    class="absolute top-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                >
                    One-click on calendar days to select them for a new
                    Campaign.
                </div>
            </div>

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
            <div class="flex items-center gap-2 ml-2">
                <button
                    class="p-1.5 hover:bg-muted rounded-md transition-colors border border-border"
                    onclick={() => navigate(-1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <span class="font-bold min-w-[140px] text-center text-base">
                    {currentDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                    })}
                </span>
                <button
                    class="p-1.5 hover:bg-muted rounded-md transition-colors border border-border"
                    onclick={() => navigate(1)}
                >
                    <ChevronRight size={18} />
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
                        class="p-2 text-center border-l border-border bg-muted/10"
                    >
                        <div
                            class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1"
                        >
                            {dayNames[i]}
                        </div>
                        <div class="text-xl font-black mb-2">
                            {date.getDate()}
                        </div>
                        <div class="space-y-1">
                            {#each getPlansForDate(date) as plan}
                                <button
                                    onclick={() => openEditPlanModal(plan)}
                                    class="w-full text-left text-[10px] font-bold px-1.5 py-0.5 rounded border border-transparent flex items-center gap-1.5 truncate hover:brightness-110 transition-all"
                                    style="background-color: {plan.color}20; color: {plan.color}; border-color: {plan.color}40"
                                >
                                    <div
                                        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style="background-color: {plan.color}"
                                    ></div>
                                    <span class="truncate">{plan.name}</span>
                                </button>
                            {/each}
                        </div>
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
                                            : `/uploads/${network.logo_url}`}
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
                    {@const isSelected = selectedDates.includes(
                        formatDate(date),
                    )}

                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => toggleDateSelection(date)}
                        class="group relative min-h-[160px] p-3 border-r border-b border-border last:border-r-0 transition-all {isSelected
                            ? 'bg-primary/5 ring-2 ring-primary ring-inset z-10'
                            : !isCurrentMonth
                              ? 'bg-muted/5 opacity-40'
                              : 'bg-background hover:bg-muted/10'}"
                        title="One-click to select date"
                    >
                        <!-- Plan Indicators (Left Bars) -->
                        <div
                            class="absolute inset-y-0 left-0 flex flex-col w-1.5 opacity-60"
                        >
                            {#each getPlansForDate(date) as plan}
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
                            {#each getPlansForDate(date) as plan}
                                <button
                                    onclick={() => openEditPlanModal(plan)}
                                    class="text-[10px] font-bold px-1.5 py-0.5 rounded border border-transparent flex items-center gap-1.5 truncate w-full text-left hover:brightness-110 transition-all"
                                    style="background-color: {plan.color}20; color: {plan.color}; border-color: {plan.color}40"
                                >
                                    <div
                                        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style="background-color: {plan.color}"
                                    ></div>
                                    <span class="truncate">{plan.name}</span>
                                </button>
                            {/each}
                        </div>

                        <!-- Posts List -->
                        <div class="space-y-1 ml-1">
                            {#each getPostsForDate(date).slice(0, 3) as post}
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
                                                        : `/uploads/${net.logo_url}`}
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
                                    <span class="text-[10px] font-bold truncate"
                                        >{net.name}</span
                                    >
                                    <div class="flex items-center gap-0.5">
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
                                </button>
                            {/each}
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

                            {#if getPlansForDate(date).length > 0}
                                <div class="space-y-2 mb-4">
                                    <p
                                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                                    >
                                        Active Campaigns
                                    </p>
                                    {#each getPlansForDate(date) as plan}
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

                            {#if getPostsForDate(date).length > 0}
                                <div class="space-y-2">
                                    <p
                                        class="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                                    >
                                        Scheduled Posts
                                    </p>
                                    {#each getPostsForDate(date) as post}
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
        class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4"
        class:pointer-events-none={isPlanGenerating}
    >
        <div
            class="bg-card border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-t-4"
            style="border-top-color: {newPlan.color}"
            class:opacity-50={isPlanGenerating}
        >
            <!-- Modal Header -->
            <div
                class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/50"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="p-1.5 rounded text-white shadow"
                        style="background-color: {newPlan.color}"
                    >
                        <Plus size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold tracking-tight">
                            {isEditingPlan ? "Campaign" : "Create Campaign"}
                        </h2>
                    </div>
                </div>
                <button
                    onclick={() => !isPlanGenerating && (showPlanModal = false)}
                    class="p-1.5 hover:bg-muted rounded transition-colors"
                    class:opacity-50={isPlanGenerating}
                    class:pointer-events-none={isPlanGenerating}
                >
                    <X size={18} />
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <!-- Left Column: Settings -->
                    <div class="md:col-span-4 space-y-6">
                        <div class="space-y-2">
                            <label
                                class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-auto"
                                >Campaign</label
                            >
                            <input
                                bind:value={newPlan.name}
                                placeholder="Campaign title..."
                                class="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-bold focus:ring-2 transition-all outline-none"
                                style="--tw-ring-color: {newPlan.color}40"
                            />
                        </div>

                        <div class="space-y-2 relative">
                            <div class="flex items-center justify-between">
                                <label
                                    class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                                    >Selected Dates</label
                                >
                                <button
                                    onclick={() => (showDatePicker = true)}
                                    class="text-xs px-2 py-1 bg-primary text-white rounded hover:brightness-110"
                                    class:opacity-50={isPlanGenerating}
                                    class:pointer-events-none={isPlanGenerating}
                                >
                                    + Add
                                </button>
                            </div>
                            {#if showDatePicker}
                                <div
                                    class="absolute top-0 right-0 bg-opacity-50"
                                >
                                    <DatePicker
                                        on:dateSelected={(e) => {
                                            addPlanDate(e.detail.date);
                                            showDatePicker = false;
                                        }}
                                    />
                                </div>
                            {/if}
                            <div
                                class="flex flex-wrap gap-1 max-h-24 overflow-y-auto"
                            >
                                {#each newPlan.dates as dStr}
                                    <div
                                        class="flex items-center gap-1 bg-muted px-2 py-1 rounded group"
                                    >
                                        <span
                                            class="text-xs font-mono font-bold"
                                            >{dStr}</span
                                        >
                                        <button
                                            onclick={() => removePlanDate(dStr)}
                                            class="text-muted-foreground hover:text-destructive transition-colors"
                                            class:opacity-50={isPlanGenerating}
                                            class:pointer-events-none={isPlanGenerating}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Social Networks Selection with Time -->
                        <div class="space-y-3">
                            <label
                                class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"
                            >
                                <Share2 size={12} />
                                Platforms
                            </label>
                            <div class="space-y-2">
                                {#if $currentProject?.social_networks}
                                    {#each $currentProject.social_networks as network}
                                        {@const isSelected =
                                            newPlan.platforms.some(
                                                (p) => p.id === network.id,
                                            )}
                                        {@const platform =
                                            newPlan.platforms.find(
                                                (p) => p.id === network.id,
                                            )}
                                        <div
                                            class="p-2 rounded-lg border-2 transition-all {isSelected
                                                ? 'bg-primary/5'
                                                : 'border-border hover:border-primary/40'}"
                                            style="border-color: {isSelected
                                                ? newPlan.color
                                                : ''}"
                                        >
                                            <div
                                                class="flex items-center justify-between"
                                            >
                                                <button
                                                    onclick={() => {
                                                        if (isSelected) {
                                                            newPlan.platforms =
                                                                newPlan.platforms.filter(
                                                                    (p) =>
                                                                        p.id !==
                                                                        network.id,
                                                                );
                                                        } else {
                                                            newPlan.platforms =
                                                                [
                                                                    ...newPlan.platforms,
                                                                    {
                                                                        id: network.id,
                                                                        publishTime:
                                                                            network.default_publish_time ||
                                                                            "10:00:00",
                                                                    },
                                                                ];
                                                        }
                                                        updatePlanPrompt();
                                                    }}
                                                    class="flex items-center gap-2"
                                                >
                                                    <div
                                                        class="w-6 h-6 rounded {getNetworkColor(
                                                            network.id,
                                                        )} flex items-center justify-center text-white text-[10px]"
                                                    >
                                                        {#if network.logo_url}
                                                            <img
                                                                src={network.logo_url}
                                                                alt={network.name}
                                                                class="w-4 h-4 rounded"
                                                            />
                                                        {:else}
                                                            <Share2 size={12} />
                                                        {/if}
                                                    </div>
                                                    <span
                                                        class="text-sm font-black truncate"
                                                    >
                                                        {network.name}
                                                    </span>
                                                </button>

                                                {#if isSelected}
                                                    <input
                                                        type="time"
                                                        bind:value={
                                                            platform.publishTime
                                                        }
                                                        onchange={(e) =>
                                                            updatePlatformPublishTime(
                                                                network.id,
                                                                e.target.value,
                                                            )}
                                                        class="text-xs px-2 py-1 rounded border border-border bg-background"
                                                        class:opacity-50={isPlanGenerating}
                                                        class:pointer-events-none={isPlanGenerating}
                                                    />
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Massive Prompt Space -->
                    <div class="md:col-span-8 flex flex-col space-y-2">
                        <label
                            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"
                        >
                            <Layers size={14} />
                            Content Pillars
                        </label>
                        <textarea
                            bind:value={newPlan.prompt}
                            placeholder="Provide detailed instructions for AI generation for each platform..."
                            class="flex-1 w-full min-h-[400px] bg-background border border-input rounded-md p-4 text-sm font-medium focus:ring-2 transition-all outline-none resize-none shadow-inner leading-relaxed"
                            style="--tw-ring-color: {newPlan.color}40"
                        ></textarea>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div
                class="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-2"
            >
                <button
                    onclick={() => !isPlanGenerating && (showPlanModal = false)}
                    class="px-4 py-2 rounded-md font-bold text-sm hover:bg-muted transition-colors border border-gray-800 dark:border-gray-300"
                    class:opacity-50={isPlanGenerating}
                    class:pointer-events-none={isPlanGenerating}
                >
                    Cancel
                </button>
                <button
                    onclick={() => !isPlanGenerating && handleCreatePlan(false)}
                    class="px-4 py-2 border rounded-md font-bold text-sm transition-all"
                    style="border-color: {newPlan.color}; color: {newPlan.color}; background-color: transparent"
                    class:opacity-50={isPlanGenerating}
                    class:pointer-events-none={isPlanGenerating}
                >
                    Save Campaign
                </button>
                {#if !isPast(newPlan.dates[newPlan.dates.length - 1])}
                    <button
                        onclick={() =>
                            !isPlanGenerating && handleCreatePlan(true)}
                        class="px-5 py-2 text-white rounded-md font-bold text-sm shadow transition-all hover:brightness-110 active:scale-95"
                        class:opacity-50={isPlanGenerating}
                        class:pointer-events-none={isPlanGenerating}
                        style="background-color: {newPlan.color}"
                    >
                        Bulk Generation
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- Bulk Generation Modal -->
{#if showGenModal}
    <div
        class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4"
        class:pointer-events-none={isGenerating}
    >
        <div
            class="bg-card border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            class:opacity-50={isGenerating}
            class:pointer-events-auto={!isGenerating}
        >
            <!-- Modal Header -->
            <div
                class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/50"
            >
                <div class="flex items-center gap-3">
                    <div class="p-1.5 rounded bg-primary text-white shadow">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold tracking-tight">
                            Bulk Generation
                        </h2>
                    </div>
                </div>
                <button
                    onclick={() => !isGenerating && (showGenModal = false)}
                    class="p-1.5 hover:bg-muted rounded transition-colors"
                    class:opacity-50={isGenerating}
                    class:pointer-events-none={isGenerating}
                >
                    <X size={18} />
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-6">
                {#if genError}
                    <div
                        class="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
                    >
                        <div class="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span class="text-sm font-medium">{genError}</span>
                        </div>
                    </div>
                {/if}

                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium mb-2 block"
                            >Selected Networks</label
                        >
                        <div class="flex flex-wrap gap-2">
                            {#each genData.selectedNetworks as networkId}
                                {@const network =
                                    $currentProject?.social_networks?.find(
                                        (n) => n.id === networkId,
                                    )}
                                {#if network}
                                    <div
                                        class="bg-muted px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                                    >
                                        <div
                                            class="w-2 h-2 rounded-full"
                                            style="background-color: {getNetworkColor(
                                                network.id,
                                            )}"
                                        ></div>
                                        {network.name}
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </div>

                    <div>
                        <label class="text-sm font-medium mb-2 block"
                            >Selected Days</label
                        >
                        <div class="flex flex-wrap gap-2">
                            {#each genData.selectedDays as day}
                                <div
                                    class="bg-muted px-3 py-1 rounded-full text-sm font-medium"
                                >
                                    {day}
                                </div>
                            {/each}
                        </div>
                    </div>

                    <div>
                        <label class="text-sm font-medium mb-2 block"
                            >Publish Time</label
                        >
                        <div
                            class="bg-muted px-3 py-1 rounded-full text-sm font-medium"
                        >
                            {genData.publishTime}
                        </div>
                    </div>

                    <div>
                        <label class="text-sm font-medium mb-2 block"
                            >Prompt</label
                        >
                        <div class="bg-muted p-3 rounded-lg text-sm">
                            {genData.prompt}
                        </div>
                    </div>
                </div>

                <!-- Progress Section -->
                {#if isGenerating}
                    <div class="space-y-4">
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <div
                                    class="w-8 h-8 border-2 border-primary/20 rounded-full"
                                ></div>
                                <div
                                    class="absolute inset-0 w-8 h-8 border-2 border-primary rounded-full border-t-transparent animate-spin"
                                ></div>
                            </div>
                            <span class="text-sm font-medium">{genStatus}</span>
                        </div>

                        <div class="w-full bg-muted rounded-full h-2">
                            <div
                                class="bg-primary h-2 rounded-full transition-all duration-500"
                                style="width: {progress}%"
                            ></div>
                        </div>

                        <div class="text-center text-sm text-muted-foreground">
                            {progress}% Complete
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div
                class="px-6 py-4 border-t border-border flex justify-end gap-3"
            >
                <button
                    onclick={() => !isGenerating && (showGenModal = false)}
                    class="px-4 py-2 border rounded-md font-bold text-sm transition-all"
                    class:opacity-50={isGenerating}
                    class:pointer-events-none={isGenerating}
                >
                    Cancel
                </button>
                <button
                    onclick={handleAutogenerate}
                    class="px-5 py-2 bg-primary text-white rounded-md font-bold text-sm shadow transition-all hover:brightness-110 active:scale-95"
                    class:opacity-50={isGenerating}
                    class:pointer-events-none={isGenerating}
                    disabled={isGenerating}
                >
                    {isGenerating ? "Generating..." : "Generate Content"}
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
