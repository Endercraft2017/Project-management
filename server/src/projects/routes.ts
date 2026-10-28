import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import prisma from "../database/client";
import { isAuthenticated } from "../auth/middleware";
import { getSocketServer } from "../chat/socket-server";
import { withTaskTopology } from "../tasks/hierarchy";

const router = Router();
const uuid = z.string().uuid();
const fields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000),
};
const counts = { _count: { select: { tasks: true, sprints: true } } } as const;
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((error) => {
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ success: false, message: "Invalid project data." });
      next(error);
    });
router.use(isAuthenticated);
router.get(
  "/",
  route(async (req, res) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        archived: z.enum(["true", "false"]).default("false"),
      })
      .parse(req.query);
    const where = query.archived === "true" ? {} : { archivedAt: null };
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: counts,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.project.count({ where }),
    ]);
    res.json({
      success: true,
      data: {
        projects,
        pagination: { page: query.page, limit: query.limit, total },
      },
    });
  }),
);
router.post(
  "/",
  route(async (req, res) => {
    const data = z
      .object({ ...fields, description: fields.description.default("") })
      .strict()
      .parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: data.name!,
        description: data.description,
        createdById: req.user!.id,
      },
      include: counts,
    });
    res.status(201).json({ success: true, data: project });
  }),
);
router.get(
  "/:id",
  route(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: uuid.parse(req.params.id) },
      include: {
        ...counts,
        tasks: {
          where:
            req.user!.role === "ADMIN"
              ? {}
              : {
                  OR: [
                    { createdById: req.user!.id },
                    { assignedToId: req.user!.id },
                  ],
                },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            taskName: true,
            progress: true,
            deadline: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    res.json({ success: true, data: project });
  }),
);
router.patch(
  "/:id",
  route(async (req, res) => {
    const projectId = uuid.parse(req.params.id);
    const data = z
      .object({
        name: fields.name.optional(),
        description: fields.description.optional(),
        archived: z.boolean().optional(),
        expectedUpdatedAt: z.string().datetime(),
      })
      .strict()
      .parse(req.body);
    const current = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!current)
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    if (req.user.role !== "ADMIN" && current.createdById !== req.user.id)
      return res.status(403).json({
        success: false,
        message: "Only the creator or administrator can edit this project.",
      });
    const update = {
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.description === undefined
        ? {}
        : { description: data.description }),
      ...(data.archived === undefined
        ? {}
        : { archivedAt: data.archived ? new Date() : null }),
    };
    if (!Object.keys(update).length)
      return res
        .status(400)
        .json({ success: false, message: "No changes supplied." });
    const result = await prisma.project.updateMany({
      where: { id: projectId, updatedAt: new Date(data.expectedUpdatedAt) },
      data: update,
    });
    if (result.count !== 1)
      return res.status(409).json({
        success: false,
        message: "The project changed. Refresh before saving.",
      });
    res.json({
      success: true,
      data: await prisma.project.findUnique({
        where: { id: projectId },
        include: counts,
      }),
    });
  }),
);
router.post(
  "/:id/tasks",
  route(async (req, res) => {
    const projectId = uuid.parse(req.params.id);
    const data = z
      .object({
        taskName: z.string().trim().min(1).max(200),
        details: z.string().trim().max(5000).optional(),
      })
      .strict()
      .parse(req.body);
    const task = await withTaskTopology(async (tx) => {
      if (
        !(await tx.project.findFirst({
          where: { id: projectId, archivedAt: null },
        }))
      )
        return null;
      return tx.task.create({
        data: {
          taskName: data.taskName,
          details: data.details,
          projectId,
          createdById: req.user!.id,
          assignedToId: req.user!.id,
          sprintId: null,
        },
      });
    });
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Active project not found." });
    try {
      getSocketServer().emit("task_created", task);
    } catch {
      console.error("Project task realtime delivery unavailable");
    }
    return res.status(201).json({ success: true, data: task });
  }),
);
export default router;
