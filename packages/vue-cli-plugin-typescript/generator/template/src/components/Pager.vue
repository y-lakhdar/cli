<template>
  <b-pagination
    :current="state.currentPage"
    :total="state.total"
    :per-page="10"
    :range-after="5"
    :range-before="5"
    @change="onChange"
  />
</template>
<script lang="ts">
import Vue from 'vue';
import {buildPager, SearchEngine} from '@coveo/headless';
import type {Pager, PagerState as HeadlessPagerState} from '@coveo/headless';

export interface PagerState extends HeadlessPagerState {
  total: number;
}
export interface IPager {
  state: PagerState;
  pager: Pager;
}

export default Vue.extend({
  name: 'Pager',
  data: function (): IPager {
    const pager = buildPager(this.$root.$data.$engine);

    return {
      pager: pager,
      state: {...pager.state, total: 0},
    };
  },
  methods: {
    onChange: function (n: number) {
      this.pager.selectPage(n);
    },
  },
  created: function () {
    this.pager.subscribe(() => {
      this.state = {
        ...this.pager.state,
        total: (this.$root.$data.$engine as SearchEngine).state.search.response
          .totalCountFiltered,
      };
    });
  },
});
</script>
