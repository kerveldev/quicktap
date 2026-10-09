<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ name: 'box' | 'bomb' | 'coin' | 'life' }>()
const failed = ref(false)
const symbols = { box: '✦', bomb: 'TNT', coin: '¢', life: '♥' }
</script>
<template>
    <span class="game-asset" :class="`asset-${name}`" aria-hidden="true"
        ><img
            v-if="!failed"
            :src="`/assets/images/${name}.png`"
            alt=""
            draggable="false"
            @error="failed = true"
        /><span v-else>{{ symbols[name] }}</span></span
    >
</template>
