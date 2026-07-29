import "./custom.css";
import DefaultTheme from "vitepress/theme";
import "@catppuccin/vitepress/theme/mocha/blue.css";
import CustomHero from "./CustomHero.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CustomHero", CustomHero);
  },
};
