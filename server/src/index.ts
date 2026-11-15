import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import {z} from 'zod';
import {enquiry,application} from './validation.js';
const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173',methods:['GET','POST']}));
app.use(express.json({limit:'16kb'}));

const schema=new mongoose.Schema({name:{type:String,required:true},email:{type:String,required:true},company:String,phone:String,service:{type:String,required:true},date:String,message:{type:String,required:true},status:{type:String,enum:['new','reviewed'],default:'new'}},{timestamps:true,strict:'throw'});
const Inquiry=mongoose.model('Inquiry',schema);
app.get('/api/health',(_req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({status:mongoose.connection.readyState===1?'ready':'database-unavailable'}));
app.post('/api/inquiries',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res,next)=>{
 const result=enquiry.safeParse(req.body);if(!result.success){res.status(400).json({error:'Please check the enquiry fields.',fields:z.flattenError(result.error).fieldErrors});return;}
 if(mongoose.connection.readyState!==1){res.status(503).json({error:'Enquiries are temporarily unavailable. Please email or call us.'});return;}
 try{const {website,...data}=result.data;const entry=await Inquiry.create(data);res.status(201).json({id:entry.id,message:'Your enquiry has been received.'});}catch(e){next(e);}
});
// Job applications from the careers page. Write-only: there is no endpoint that reads them back.
const applicationSchema=new mongoose.Schema({name:{type:String,required:true},email:{type:String,required:true},phone:{type:String,required:true},city:String,role:{type:String,required:true},languages:String,experience:String,status:{type:String,enum:['new','reviewed'],default:'new'}},{timestamps:true,strict:'throw'});
const Application=mongoose.model('Application',applicationSchema);
app.post('/api/applications',rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res,next)=>{
 const result=application.safeParse(req.body);if(!result.success){res.status(400).json({error:'Please check the application fields.',fields:z.flattenError(result.error).fieldErrors});return;}
 if(mongoose.connection.readyState!==1){res.status(503).json({error:'Applications are temporarily unavailable. Please email or call us.'});return;}
 try{const {website,...data}=result.data;const entry=await Application.create(data);res.status(201).json({id:entry.id,message:'Your application has been received.'});}catch(e){next(e);}
});
app.use((_req,res)=>res.status(404).json({error:'Not found'}));
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{if(error instanceof SyntaxError){res.status(400).json({error:'Invalid request body'});return;}console.error('Request failed:',error instanceof Error?error.name:'UnknownError');res.status(500).json({error:'Something went wrong. Please try again later.'});});
const uri=process.env.MONGODB_URI;if(!uri)throw new Error('MONGODB_URI must be configured');
await mongoose.connect(uri,{serverSelectionTimeoutMS:5000});
const server=app.listen(Number(process.env.PORT)||4000,()=>console.log('Xposure API ready'));
async function shutdown(){server.close();await mongoose.disconnect();process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
