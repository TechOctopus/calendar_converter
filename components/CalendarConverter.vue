<script setup lang="ts">
const handleSubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const jsonData = formData.get("timetable") as string;
  convertTimetableToICS(jsonData);
};
</script>

<template>
  <div class="gap-4">
    <form @submit="handleSubmit">
      <textarea name="timetable" placeholder="Paste your JSON here" />
      <button>Convert to ICS</button>
    </form>
  </div>
</template>
