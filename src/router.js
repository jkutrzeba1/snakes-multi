import VueRouter from 'vue-router';
import Vue from 'vue';

const Stats = require("./Stats.vue").default;
const Ranking = require("./Ranking.vue").default;

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    components: {
      tabs: Ranking
    },
    redirect: "/ranking"
  },
  {
    path: "/ranking",
    components: {
        tabs: Ranking
    }
  },
  {
    path: "/stats",
    components: {
      tabs: Stats
    }
  }
];

const Router = new VueRouter({
  routes
})

export default Router;
