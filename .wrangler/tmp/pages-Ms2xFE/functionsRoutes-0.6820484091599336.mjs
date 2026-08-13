import { onRequestGet as __api_search_js_onRequestGet } from "C:\\Users\\HP\\Desktop\\试练\\词典GPT\\functions\\api\\search.js"
import { onRequestGet as __health_js_onRequestGet } from "C:\\Users\\HP\\Desktop\\试练\\词典GPT\\functions\\health.js"

export const routes = [
    {
      routePath: "/api/search",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_search_js_onRequestGet],
    },
  {
      routePath: "/health",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__health_js_onRequestGet],
    },
  ]