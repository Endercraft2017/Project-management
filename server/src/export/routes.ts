import { Router } from "express";
import rateLimit from "express-rate-limit";
import { isAdmin } from "../auth/middleware";
import { getTenantContext } from "../tenancy/context";
import { exportWorkspace, ExportError } from "./service";

const router = Router();
let responseBusy = false;
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
router.use(isAdmin);
router.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${getTenantContext().id}:${req.user!.id}`,
    message: {
      success: false,
      error: "EXPORT_RATE_LIMIT",
      message:
        "Workspace exports are limited to two per administrator per hour. Try again later.",
    },
  }),
);
router.get("/workspace", async (req, res, next) => {
  if (Object.keys(req.query).length) {
    res.status(400).json({
      success: false,
      error: "INVALID_EXPORT_REQUEST",
      message: "Workspace export does not accept query parameters.",
    });
    return;
  }
  if (responseBusy) {
    res
      .status(429)
      .json({
        success: false,
        error: "EXPORT_BUSY",
        message: "An export is already running. Try again later.",
      });
    return;
  }
  // Hold the response slot through delivery, so slow clients cannot accumulate
  // many near-limit buffers after snapshot generation has completed.
  responseBusy = true;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      responseBusy = false;
    }
  };
  res.once("finish", release);
  res.once("close", release);
  try {
    const result = await exportWorkspace({
      id: req.user!.id,
      sessionVersion: req.session.sessionVersion ?? -1,
    });
    res.attachment(result.filename).type("application/json").send(result.json);
  } catch (error) {
    if (error instanceof ExportError) {
      res
        .status(error.status)
        .json({ success: false, error: error.code, message: error.message });
      return;
    }
    next(error);
  }
});
export default router;
