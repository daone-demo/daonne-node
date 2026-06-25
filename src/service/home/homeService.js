import { store } from "../../infrastructure/db/memoryStore.js";
import { listProjects } from "../creation/projectService.js";

export function home(userId, categoryCode = "ALL") {
  const categories = inspirationCategories();
  const enabledCategoryCodes = new Set(categories.filter((item) => item.code !== "ALL").map((item) => item.code));
  const selectedCategory = String(categoryCode || "ALL");
  const inspirations = [...store.inspirations.values()]
    .filter((item) => item.status === "ENABLED")
    .filter((item) => enabledCategoryCodes.has(item.categoryCode))
    .filter((item) => selectedCategory === "ALL" || item.categoryCode === selectedCategory)
    .sort((a, b) => a.sortNo - b.sortNo);
  return {
    recentProjects: userId ? listProjects(userId).slice(0, 6) : [],
    inspirationCategories: categories,
    inspirations
  };
}

function inspirationCategories() {
  const categories = [...store.contentCategories.values()]
    .filter((item) => !item.deleted)
    .filter((item) => item.status === "ENABLED")
    .filter((item) => ["ALL", "INSPIRATION"].includes(item.scope || "ALL"))
    .sort((a, b) => Number(a.sortNo || 0) - Number(b.sortNo || 0))
    .map((item) => ({
      code: item.categoryCode,
      name: item.categoryName,
      sortNo: item.sortNo,
      scope: item.scope
    }));
  return [{ code: "ALL", name: "全部" }, ...categories];
}
