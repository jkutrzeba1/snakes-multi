import VueRouter from 'vue-router';
import Vue from 'vue';

const Stats = require("./Stats.vue").default;
const Ranking = require("./Ranking.vue").default;
const LoginForm = require("./LoginForm.vue").default;
const RegisterForm = require("./RegisterForm.vue").default;

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
    path: "/login",
    components: {
      credentials: LoginForm
    }
  },
  {
    path: "/register",
    components: {
      credentials: RegisterForm
    }
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
