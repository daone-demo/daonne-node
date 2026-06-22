import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId } from "../../infrastructure/common/id.js";
import { badRequest, conflict, forbidden, notFound } from "../common/errors.js";

const defaultViewport = () => ({
  zoom: 1,
  translateX: 0,
  translateY: 0,
  scrollLeft: 0,
  scrollTop: 0
});

const defaultMeta = (projectId = "", projectName = "未命名创作") => ({
  projectId: String(projectId),
  projectName: projectName || "未命名创作",
  canvasBgTheme: "light",
  gridVisible: false,
  panMode: false,
  showMinimap: false
});

const emptyCanvas = (projectId = "", projectName = "未命名创作") => ({
  version: 1,
  savedAt: new Date().toISOString(),
  meta: defaultMeta(projectId, projectName),
  viewport: defaultViewport(),
  graph: { cells: [] },
  summary: { nodeCount: 0, edgeCount: 0 }
});

export function createProject(userId, title = "未命名创作") {
  const id = nextId();
  const t = new Date().toISOString();
  const project = {
    id,
    userId,
    title: title || "未命名创作",
    coverAssetId: null,
    status: "ACTIVE",
    createdAt: t,
    updatedAt: t
  };
  store.projects.set(id, project);
  store.canvases.set(id, {
    projectId: id,
    canvas: emptyCanvas(id, title),
    revision: 0,
    updatedAt: t
  });
  return toProjectView(project);
}

export function listProjects(userId, keyword) {
  return [...store.projects.values()]
    .filter((item) => item.userId === userId && item.status === "ACTIVE")
    .filter((item) => !keyword || item.title.includes(keyword))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toProjectView);
}

export function getProject(userId, projectId) {
  return toProjectView(requireProject(userId, projectId));
}

export function updateProject(userId, projectId, body) {
  const project = requireProject(userId, projectId);
  if (body.title !== undefined) project.title = body.title;
  if (body.coverAssetId !== undefined) {
    project.coverAssetId = body.coverAssetId === null ? null : assertAccessibleAsset(userId, body.coverAssetId).id;
  }
  project.updatedAt = new Date().toISOString();
  return toProjectView(project);
}

export function deleteProject(userId, projectId) {
  const project = requireProject(userId, projectId);
  project.status = "DELETED";
  project.updatedAt = new Date().toISOString();
}

export function getCanvas(userId, projectId) {
  requireProject(userId, projectId);
  return toCanvasView(store.canvases.get(String(projectId)));
}

export function saveCanvas(userId, projectId, body) {
  const project = requireProject(userId, projectId);
  const current = store.canvases.get(String(projectId));
  const expectedRevision = Number(body.baseRevision ?? body.revision ?? current.revision);
  if (expectedRevision !== current.revision) {
    throw conflict("CANVAS_REVISION_CONFLICT", "画布版本冲突，请先刷新", {
      latestRevision: current.revision
    });
  }
  const rawCanvas = extractCanvasInput(body);
  const canvasData = normalizeCanvasPayload(rawCanvas, projectId, project, current.canvas);
  if (!canvasData) {
    throw badRequest("PARAM_INVALID", "canvasData 不能为空或格式无效");
  }
  const t = new Date().toISOString();
  canvasData.savedAt = t;
  if (canvasData.meta?.projectName && canvasData.meta.projectName !== project.title) {
    project.title = canvasData.meta.projectName;
    project.updatedAt = t;
  }
  current.revision += 1;
  current.canvas = canvasData;
  current.updatedAt = t;
  if ((body.saveType || "MANUAL") === "MANUAL") {
    const versionId = nextId();
    store.versions.set(versionId, {
      id: versionId,
      projectId: String(projectId),
      versionNo: current.revision,
      canvas: current.canvas,
      createdAt: t
    });
  }
  return { ...toCanvasView(current), savedAt: t };
}

export function listVersions(userId, projectId) {
  requireProject(userId, projectId);
  return [...store.versions.values()]
    .filter((item) => item.projectId === String(projectId))
    .sort((a, b) => b.versionNo - a.versionNo)
    .map(({ id, versionNo, createdAt }) => ({ id, versionNo, createdAt }));
}

export function getVersion(userId, projectId, versionId) {
  requireProject(userId, projectId);
  const version = store.versions.get(String(versionId));
  if (!version || version.projectId !== String(projectId)) {
    throw notFound("历史版本不存在");
  }
  return toVersionView(version);
}

export function restoreVersion(userId, projectId, versionId) {
  const version = getVersion(userId, projectId, versionId);
  return saveCanvas(userId, projectId, {
    baseRevision: getCanvas(userId, projectId).revision,
    canvasData: version.canvas,
    saveType: "MANUAL"
  });
}

export function requireProject(userId, projectId) {
  const project = store.projects.get(String(projectId));
  if (!project || project.status !== "ACTIVE") {
    throw notFound("项目不存在");
  }
  if (project.userId !== userId) {
    throw forbidden();
  }
  return project;
}

function toProjectView(project) {
  const canvas = store.canvases.get(project.id);
  const cover = project.coverAssetId ? store.assets.get(String(project.coverAssetId)) : null;
  return {
    id: project.id,
    title: project.title,
    coverAssetId: project.coverAssetId,
    coverUrl: cover?.previewUrl || null,
    revision: canvas?.revision ?? 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function toCanvasView(canvas) {
  if (!canvas) return null;
  return {
    projectId: canvas.projectId,
    revision: canvas.revision,
    canvasData: canvas.canvas,
    canvas: canvas.canvas,
    updatedAt: canvas.updatedAt
  };
}

function toVersionView(version) {
  return {
    id: version.id,
    projectId: version.projectId,
    versionNo: version.versionNo,
    canvasData: version.canvas,
    canvas: version.canvas,
    createdAt: version.createdAt
  };
}

function assertAccessibleAsset(userId, assetId) {
  const asset = store.assets.get(String(assetId));
  if (!asset || asset.reviewStatus === "DELETED") {
    throw notFound("素材不存在");
  }
  if (asset.userId !== userId && asset.source !== "TEMPLATE") {
    throw forbidden();
  }
  return asset;
}

function isCanvasSnapshot(data) {
  return Boolean(
    data &&
      typeof data === "object" &&
      data.version === 1 &&
      data.graph &&
      typeof data.graph === "object"
  );
}

function isLegacyCanvas(data) {
  return Boolean(
    data &&
      typeof data === "object" &&
      ("schemaVersion" in data || Array.isArray(data.nodes) || Array.isArray(data.edges))
  );
}

function isX6GraphData(data) {
  return Boolean(data && typeof data === "object" && Array.isArray(data.cells));
}

function extractCanvasInput(body) {
  if (!body || typeof body !== "object") return null;
  const candidates = [body.canvasData, body.canvas];
  if (isCanvasSnapshot(body) || isX6GraphData(body) || isLegacyCanvas(body)) {
    candidates.unshift(body);
  }
  return candidates.find((item) => item && typeof item === "object") ?? null;
}

function summarizeGraph(graph) {
  const cells = Array.isArray(graph?.cells) ? graph.cells : [];
  const edgeCount = cells.filter((cell) => cell?.source && cell?.target).length;
  return {
    nodeCount: cells.length - edgeCount,
    edgeCount
  };
}

function buildSnapshotFromGraph(graph, projectId, project, existingCanvas = null) {
  const existing = isCanvasSnapshot(existingCanvas) ? existingCanvas : null;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    meta: existing?.meta ?? defaultMeta(projectId, project?.title),
    viewport: existing?.viewport ?? defaultViewport(),
    graph,
    summary: summarizeGraph(graph)
  };
}

function convertLegacyToSnapshot(legacy, projectId, project) {
  const cells = [...(legacy.nodes || []), ...(legacy.edges || [])];
  const viewport = legacy.viewport || {};
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    meta: defaultMeta(projectId, project?.title),
    viewport: {
      zoom: viewport.zoom ?? 1,
      translateX: viewport.x ?? 0,
      translateY: viewport.y ?? 0,
      scrollLeft: 0,
      scrollTop: 0
    },
    graph: {
      cells,
      ...(Array.isArray(legacy.groups) ? { groups: legacy.groups } : {})
    },
    summary: {
      nodeCount: (legacy.nodes || []).length,
      edgeCount: (legacy.edges || []).length
    }
  };
}

function normalizeCanvasPayload(raw, projectId, project, existingCanvas = null) {
  if (!raw || typeof raw !== "object") return null;
  if (isCanvasSnapshot(raw)) {
    return {
      version: 1,
      savedAt: raw.savedAt || new Date().toISOString(),
      meta: {
        ...defaultMeta(projectId, project?.title),
        ...(raw.meta || {}),
        projectId: String(raw.meta?.projectId ?? projectId)
      },
      viewport: {
        ...defaultViewport(),
        ...(raw.viewport || {})
      },
      graph: raw.graph,
      summary: raw.summary || summarizeGraph(raw.graph)
    };
  }
  if (isX6GraphData(raw)) {
    return buildSnapshotFromGraph(raw, projectId, project, existingCanvas);
  }
  if (isLegacyCanvas(raw)) {
    return convertLegacyToSnapshot(raw, projectId, project);
  }
  return null;
}
