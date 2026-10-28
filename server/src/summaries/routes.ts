/** Tenant-scoped reads and durable, capped AI admission. Legacy side effects remain disabled. */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { weeklySummariesController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import { getTenantContext } from '@/tenancy/context';
import { getControlPool } from '@/platform/store';
import { enqueueJob, ensureJobSchema, workerIsReady } from '@/platform/jobs';
import { openAIService } from '@/services/openai.service';

const router = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}, 'Use a valid calendar date');
const handle = (fn:(req:Request,res:Response)=>Promise<unknown>) => (req:Request,res:Response,next:NextFunction) => {
  fn(req,res).catch((error) => {
    if(error instanceof ZodError){res.status(400).json({success:false,error:'INVALID_REQUEST',message:'Check the submitted date or identifier'});return;}
    next(error);
  });
};
router.param('weekDate',(req,res,next,value)=>{
  if(!date.safeParse(value).success){res.status(400).json({success:false,error:'INVALID_DATE',message:'Use a valid calendar date'});return;}
  next();
});
const safeStatus = (row:any) => ({id:row.id,status:row.status,attempts:row.attempts,maxAttempts:row.max_attempts,
  errorCode:typeof row.last_error_code==='string'&&/^[A-Z0-9_]{1,80}$/.test(row.last_error_code)?row.last_error_code:null,
  createdAt:new Date(row.created_at).toISOString(),finishedAt:row.finished_at?new Date(row.finished_at).toISOString():null});

router.get('/',isAuthenticated,(req,res,next)=>{weeklySummariesController.list(req,res,next);});
router.get('/availability',isAdmin,handle(async(_req,res)=>{
  const availability=await openAIService.getAvailability(),ready=await workerIsReady();
  res.json({success:true,data:{...availability,canGenerate:availability.canGenerate&&ready,
    reason:availability.reason||(!ready?'WORKER_UNAVAILABLE':null),workerReady:ready}});
}));
router.get('/scheduler/status',isAdmin,handle(async(_req,res)=>{
  const ready=await workerIsReady();
  res.json({success:true,data:{isRunning:ready,workerReady:ready,mode:'durable',apiSchedulerRunning:false,
    timezone:process.env.SCHEDULER_TIMEZONE||'UTC',currentTime:new Date().toISOString()}});
}));
router.get('/jobs/:id',isAdmin,handle(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id);
  await ensureJobSchema();
  const result=await getControlPool().query(`SELECT id,status,attempts,max_attempts,last_error_code,created_at,finished_at
    FROM ez_control.jobs WHERE id=$1 AND tenant_id=$2 AND kind='summary_generate'`,[id,getTenantContext().id]);
  if(!result.rows.length){res.status(404).json({success:false,error:'JOB_NOT_FOUND',message:'Summary job not found'});return;}
  res.json({success:true,data:safeStatus(result.rows[0])});
}));
router.post('/generate',isAdmin,handle(async(req,res)=>{
  const input=z.object({weekDate:date}).strict().parse(req.body);
  const parsed=new Date(`${input.weekDate}T12:00:00Z`),day=parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate()+(day===0?-6:1-day));
  const weekDate=parsed.toISOString().slice(0,10);
  const availability=await openAIService.getAvailability();
  if(!availability.canGenerate){
    const status=availability.reason==='AI_DISABLED'?503:403;
    res.status(status).json({success:false,error:availability.reason,message:availability.reason==='AI_DISABLED'?'AI generation is not configured':'Workspace AI allowance is unavailable or exhausted'});return;
  }
  if(!await workerIsReady()){res.status(503).json({success:false,error:'WORKER_UNAVAILABLE',message:'The background worker is unavailable; no generation was queued'});return;}
  const jobId=await enqueueJob('summary_generate',{weekDate,actorId:req.user!.id},`summary-generate:${weekDate}`,1);
  const result=await getControlPool().query("SELECT status FROM ez_control.jobs WHERE id=$1 AND tenant_id=$2",[jobId,getTenantContext().id]);
  res.status(202).json({success:true,data:{jobId,status:result.rows[0].status,weekDate},message:'Summary generation is tracked as a background job'});
}));
router.get('/:weekDate/grouped',isAuthenticated,(req,res,next)=>{weeklySummariesController.getGrouped(req,res,next);});
router.get('/:weekDate',isAuthenticated,(req,res,next)=>{weeklySummariesController.getByWeek(req,res,next);});
router.use((_req,res)=>{res.status(503).json({success:false,error:'CAPABILITY_DISABLED',message:'Direct email, destructive deletion and legacy triggers are disabled; use the durable generation workflow'});});
export default router;
