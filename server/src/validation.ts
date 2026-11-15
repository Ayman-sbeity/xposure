import {z} from 'zod';
// Service names must match client/content/services.ts.
export const enquiry=z.strictObject({
 name:z.string().trim().min(2).max(100),
 email:z.string().trim().max(254).pipe(z.email()),
 company:z.string().trim().max(150).optional(),
 phone:z.string().trim().max(30).regex(/^[+\d\s()-]*$/,{error:'Use digits, spaces, +, - and brackets only'}).optional(),
 service:z.enum(['Hostesses & receptionists','Event coordination','Promotion & sales','Photo marketing','Brand consulting']),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
 message:z.string().trim().min(10).max(4000),
 website:z.string().max(0).optional()
});

// Role names must match the English role list in client/i18n/strings.ts (careers.roles).
export const application=z.strictObject({
 name:z.string().trim().min(2).max(100),
 email:z.string().trim().max(254).pipe(z.email()),
 phone:z.string().trim().min(6).max(30).regex(/^[+\d\s()-]*$/,{error:'Use digits, spaces, +, - and brackets only'}),
 city:z.string().trim().max(100).optional(),
 role:z.enum(['Hostess / host','Receptionist','Promoter','Event coordination']),
 languages:z.string().trim().max(150).optional(),
 experience:z.string().trim().max(2000).optional(),
 website:z.string().max(0).optional()
});
