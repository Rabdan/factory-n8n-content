<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  import utc from 'dayjs/plugin/utc';
  import timezone from 'dayjs/plugin/timezone';
  dayjs.extend(utc);
  dayjs.extend(timezone);

  export let tz: string = 'UTC';
  const dispatch = createEventDispatcher<{ dateSelected: { date: string } }>();

  // Initialize in the target timezone
  let month = dayjs().tz(tz).month();
  let year = dayjs().tz(tz).year();

  const monthNames = [
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ];

  function daysInMonth(y: number, m: number) {
    return dayjs(new Date(y, m + 1, 0)).tz(tz).date();
  }

  // Monday as first day
  function firstWeekdayMonday(y: number, m: number) {
    const d = new Date(y, m, 1).getDay(); // 0=Sun
    return (d + 6) % 7; // 0=Mon
  }

  function toDate(y: number, m: number, d: number) {
    return dayjs({ year: y, month: m, date: d }).tz(tz).toDate();
  }

  function pickDate(d: Date) {
    const s = dayjs(d).tz(tz).format('YYYY-MM-DD');
    dispatch('dateSelected', { date: s });
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
    <button class="px-1" on:click={prevMonth} aria-label="Previous month">«</button>
    <span class="font-bold">{monthNames[month]} {year}</span>
    <button class="px-1" on:click={nextMonth} aria-label="Next month">»</button>
  </div>
  <div class="grid grid-cols-7 gap-1 text-xs text-center mb-2">
    {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as d}
      <div class="opacity-70">{d}</div>
    {/each}
  </div>
  <div class="grid grid-cols-7 gap-1 text-center">
    {#each days as cell}
      {#if cell}
        <button class="p-1 rounded hover:bg-gray-100" on:click={() => pickDate(cell)}>
          {cell.getDate()}
        </button>
      {:else}
        <div class="p-1 opacity-0">&nbsp;</div>
      {/if}
    {/each}
  </div>
</div>
