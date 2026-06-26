import { nextId } from "../../infrastructure/common/id.js";
import { store } from "../../infrastructure/db/memoryStore.js";
import { badRequest } from "../common/errors.js";
import { requireProject } from "./projectService.js";

export function createCanvasElementGroup(userId, projectId, body) {
  const project = requireProject(userId, projectId);
  const name = normalizeName(body.projectName ?? body.name);
  const structure = body.projectStructure ?? body.structureJson ?? body.structure;
  if (!name) {
    throw badRequest("PARAM_INVALID", "项目名称不能为空");
  }
  if (!structure || typeof structure !== "object" || Array.isArray(structure)) {
    throw badRequest("PARAM_INVALID", "项目结构不能为空或格式无效");
  }
  const t = new Date().toISOString();
  const id = nextId();
  const group = {
    id,
    userId,
    projectId: String(project.id),
    name,
    description: normalizeDescription(body.projectDescription ?? body.description),
    structure,
    deleted: false,
    createdAt: t,
    updatedAt: t
  };
  store.canvasElementGroups.set(id, group);
  return toDetail(group);
}

export function listCanvasElementGroups(userId, projectId) {
  requireProject(userId, projectId);
  return [...store.canvasElementGroups.values()]
    .filter((item) => item.userId === userId && item.projectId === String(projectId) && !item.deleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toDetail);
}

function toListItem(group) {
  return {
    id: group.id,
    projectId: group.projectId,
    projectName: group.name,
    projectDescription: group.description,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

function toDetail(group) {
  return {
    ...toListItem(group),
    projectStructure: group.structure,
    structureJson: group.structure
  };
}

function normalizeName(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeDescription(value) {
  const text = String(value ?? "").trim();
  return text || null;
}
