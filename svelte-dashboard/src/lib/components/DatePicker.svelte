<script lang="ts">
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher<{
        dateSelected: { date: string };
    }>();

    let month = new Date().getMonth();
    let year = new Date().getFullYear();

    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    function daysInMonth(y: number, m: number) {
        return new Date(y, m + 1, 0).getDate();
    }

    // Monday as first day: compute offset from Monday
    function firstWeekdayMonday(y: number, m: number) {
        const d = new Date(y, m, 1).getDay(); // 0=Sun
        return (d + 6) % 7; // 0=Mon
    }

    function toDate(y: number, m: number, d: number) {
        return new Date(y, m, d);
    }

    function pickDate(d: Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;
        dispatch("dateSelected", { date: formattedDate });
    }

    function prevMonth() {
        if (month === 0) {
            month = 11;
            year = year - 1;
        } else {
            month = month - 1;
        }
    }
    function nextMonth() {
        if (month === 11) {
            month = 0;
            year = year + 1;
        } else {
            month = month + 1;
        }
    }

    // Build days array for current month view (42 cells to cover 6 weeks)
    $: days = buildDays(year, month);
    function buildDays(y: number, m: number) {
        const firstOffset = firstWeekdayMonday(y, m);
        const total = daysInMonth(y, m);
        const arr: (Date | null)[] = [];
        for (let i = 0; i < firstOffset; i++) arr.push(null);
        for (let d = 1; d <= total; d++) arr.push(toDate(y, m, d));
        while (arr.length % 7 !== 0) arr.push(null);
        return arr;
    }
</script>

<div class="bit-calendar bg-white rounded shadow p-3 border border-gray-200">
    <div class="flex justify-between items-center mb-2 text-sm">
        <button class="px-1" on:click={prevMonth} aria-label="Previous month"
            >«</button
        >
        <span class="font-bold">{monthNames[month]} {year}</span>
        <button class="px-1" on:click={nextMonth} aria-label="Next month"
            >»</button
        >
    </div>
    <div class="grid grid-cols-7 gap-1 text-xs text-center mb-2">
        {#each ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as d}
            <div class="opacity-70">{d}</div>
        {/each}
    </div>
    <div class="grid grid-cols-7 gap-1 text-center">
        {#each days as cell}
            {#if cell}
                <button
                    class="p-1 rounded hover:bg-gray-100"
                    on:click={() => pickDate(cell)}
                >
                    {cell.getDate()}
                </button>
            {:else}
                <div class="p-1 opacity-0">&nbsp;</div>
            {/if}
        {/each}
    </div>
</div>
