/** Only typed tenant settings are exposed; legacy direct email/reminder handlers stay unreachable. */
import { Router } from 'express';
import { adminController } from './controller';
import { isAdmin } from '@/auth/middleware';
import { workerIsReady } from '@/platform/jobs';
const router=Router();
router.use(isAdmin);
router.get('/worker/status',async(_req,res,next)=>{try{const ready=await workerIsReady();res.json({success:true,data:{workerReady:ready,isRunning:ready,mode:'durable',apiSchedulerRunning:false}});}catch(error){next(error);}});
router.get('/settings/weekly-summary-email/config',(req,res,next)=>{adminController.getWeeklySummaryEmailConfig(req,res,next);});
router.put('/settings/weekly-summary-email/config',(req,res,next)=>{adminController.updateWeeklySummaryEmailConfig(req,res,next);});
router.get('/settings/weekly-summary-members/config',(req,res,next)=>{adminController.getWeeklySummaryMembersConfig(req,res,next);});
router.put('/settings/weekly-summary-members/config',(req,res,next)=>{adminController.updateWeeklySummaryMembersConfig(req,res,next);});
router.get('/settings/missing-updates/config',(req,res,next)=>{adminController.getMissingUpdatesConfig(req,res,next);});
router.put('/settings/missing-updates/config',(req,res,next)=>{adminController.updateMissingUpdatesConfig(req,res,next);});
router.get('/settings/automated-reminder/config',(req,res,next)=>{adminController.getAutomatedReminderConfig(req,res,next);});
router.put('/settings/automated-reminder/config',(req,res,next)=>{adminController.updateAutomatedReminderConfig(req,res,next);});
router.use((_req,res)=>{res.status(503).json({success:false,error:'CAPABILITY_DISABLED',message:'Legacy direct reminders, arbitrary settings and destructive settings operations are disabled'});});
export default router;
