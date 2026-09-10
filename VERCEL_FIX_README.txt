WHY THIS FIX IS NEEDED
Your updated project has 15 top-level JavaScript files in /api.
On Vercel Hobby, the deployment can fail after "Build Completed" when the Serverless Function count exceeds the plan limit.

THIS PATCH REDUCES THE PROJECT TO 10 API FUNCTIONS.

DO THIS
1) Replace/add the files from this patch in the same project paths.
2) DELETE these 7 old files from your project:
   api/_server.js
   api/go-business.js
   api/go-tool.js
   api/go-job.js
   api/go-sponsor.js
   api/line-connect-start.js
   api/line-callback.js
3) Make sure these new files exist:
   server/_server.js
   api/go.js
4) Commit and push:
   git add .
   git commit -m "Fix Vercel Hobby function limit"
   git push origin main

The removed LINE connect/callback endpoints were the older account-linked LINE flow. Your newer QR/no-login LINE webhook + preferences flow stays intact.
