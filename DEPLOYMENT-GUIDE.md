# Deployment Guide - Backend (Render) & Frontend (Vercel)

## 🎯 Overview

Your auction platform is now ready for deployment with:
- ✅ Neon PostgreSQL database (cloud)
- ✅ Neon Object Storage for images (S3-compatible)
- ✅ All migrations applied
- ✅ Image uploads using cloud storage (no more local disk!)

---

## 📦 Step 1: Deploy Backend to Render

### A. Create Render Account
1. Go to https://render.com
2. Sign up with GitHub (recommended for easy repo connection)

### B. Create Web Service

1. **Click "New +" → "Web Service"**
2. **Connect Repository:**
   - Select your GitHub repository
   - Or paste repo URL: `https://github.com/yourusername/E-bay`

3. **Configure Service:**
   ```
   Name: nexlo-backend (or your choice)
   Region: Ohio (US East) - same as your Neon database
   Branch: main (or your production branch)
   Runtime: Node
   Build Command: npm install
   Start Command: node server/index.mjs
   ```

4. **Select Plan:**
   - **Free tier** (0.1 CPU, 512 MB RAM)
   - ⚠️ Sleeps after 15 min inactivity
   - ⚠️ Cold start ~30-60 seconds on wake

### C. Environment Variables

Click "Environment" and add these variables from your `.env` file:

#### **Database (Required)**
```bash
DATABASE_URL=postgresql://neondb_owner:npg_...@ep-divine-credit-b5zophl9-pooler.c-7.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

#### **Object Storage (Required)**
```bash
AWS_ACCESS_KEY_ID=nak_live_3a1a29f79a914fd6b12042657b840292
AWS_SECRET_ACCESS_KEY=nsk_live_51cf0e0bf9f7b18b43168846a0702e6ba0f4eb9f17a84e828ae7deb589c8bca0
AWS_ENDPOINT_URL_S3=https://br-cool-surf-b5ge95du.storage.c-7.us-east-2.aws.neon.tech
AWS_REGION=us-east-2
```

#### **API Configuration (Required)**
```bash
NODE_ENV=production
API_PORT=4000
```

⚠️ **DO NOT SET** `USE_PGLITE` - it defaults to 0 (PostgreSQL)

#### **CORS (Required - Update After Deploy)**
```bash
CORS_ORIGIN=https://your-frontend.vercel.app
```
*Update this after deploying frontend to Vercel*

#### **JWT Secret (Required - Generate New!)**
```bash
JWT_SECRET=your-super-secret-production-key-min-32-chars
```
⚠️ **Generate a new secret for production!**
```bash
# Generate with Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### **Payment Gateways (Optional - Add When Ready)**
```bash
ESEWA_MERCHANT_ID=your_production_merchant_id
ESEWA_SECRET_KEY=your_production_secret_key
ESEWA_GATEWAY_URL=https://esewa.com.np/epay/main

KHALTI_SECRET_KEY=your_production_khalti_key
KHALTI_GATEWAY_URL=https://khalti.com/api/v2/
```

### D. Deploy!

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repo
   - Run `npm install`
   - Start `node server/index.mjs`
3. Watch the logs for any errors
4. **Copy your backend URL:** `https://nexlo-backend.onrender.com`

### E. Test Backend

Once deployed, test:
```bash
curl https://your-backend.onrender.com/health
```

Expected response:
```json
{"status":"ok","service":"nexlo","runtime":"node","database":"connected"}
```

---

## 🌐 Step 2: Deploy Frontend to Vercel

### A. Vercel Dashboard
1. Go to https://vercel.com
2. Import your project (if not already)

### B. Update Environment Variables

In your Vercel project dashboard:

**Settings → Environment Variables → Add:**

```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

⚠️ **Important:** Replace with your actual Render backend URL!

### C. Redeploy Frontend

1. **Trigger redeploy** from Vercel dashboard
2. Or push a commit to trigger auto-deploy
3. Vercel will rebuild with new env vars

---

## 🔄 Step 3: Update Backend CORS

Once frontend is deployed:

1. **Go back to Render** → Your Web Service
2. **Environment → Edit `CORS_ORIGIN`**
3. **Update to:** `https://your-frontend.vercel.app`
4. **Save changes** → Render will auto-redeploy

---

## ✅ Step 4: Verification Checklist

### Backend Health Check
- [ ] Backend URL responds to `/health`
- [ ] Database connection working (`"database":"connected"`)
- [ ] Logs show no errors

### Frontend Connection
- [ ] Frontend loads without errors
- [ ] API calls reach backend (check Network tab)
- [ ] No CORS errors in browser console

### Image Uploads
- [ ] Can create a listing
- [ ] Photo upload works
- [ ] Photos display correctly
- [ ] Thumbnails load
- [ ] Photos persist after Render restarts

### Authentication
- [ ] Registration works
- [ ] Login works
- [ ] JWT tokens issued
- [ ] Protected routes work

---

## ⚠️ Important Notes

### 1. **Free Tier Limitations (Render)**
- Sleeps after 15 min inactivity
- Cold start adds 30-60 second delay on wake
- 512 MB RAM limit
- 750 hours/month free (enough for 24/7)

**Solutions:**
- Upgrade to paid plan ($7/mo) for no sleep
- Use a service like BetterUptime to ping every 14 min
- Accept the cold start delay (good for MVP/testing)

### 2. **Image Storage**
- ✅ Now using Neon Object Storage
- ✅ Images persist across restarts
- ✅ 1GB free storage
- ✅ Public read access
- ✅ Direct S3 URLs (no backend proxy)

### 3. **Database Connection Pooling**
- Your `DATABASE_URL` uses `-pooler` suffix
- Perfect for serverless/connection-per-request
- Migrations should use `DATABASE_URL_UNPOOLED`

### 4. **Security Checklist**
- [ ] JWT_SECRET is strong and unique
- [ ] CORS_ORIGIN matches your frontend exactly
- [ ] Payment gateway keys are production keys
- [ ] Environment variables not committed to git
- [ ] Rate limiting active (already implemented ✓)

---

## 🚀 Optional: Deploy to Other Platforms

### Railway (Alternative)
**Pros:** No sleep, $5 free credits/month  
**Cons:** Requires credit card

```bash
# Railway CLI deployment
railway login
railway init
railway up
railway variables set DATABASE_URL=...
```

### Fly.io (Alternative)
**Pros:** 3 VMs free, no sleep  
**Cons:** More complex setup (Docker-based)

```bash
fly launch
fly secrets set DATABASE_URL=...
fly deploy
```

---

## 📊 Monitor Your Deployment

### Render Dashboard
- View logs in real-time
- Monitor memory/CPU usage
- Track deploy history

### Neon Dashboard
- Monitor database usage
- View connection metrics
- Check storage size

### Vercel Dashboard
- View frontend analytics
- Monitor API requests
- Check edge function logs

---

## 🔧 Troubleshooting

### Backend won't start
1. Check Render logs
2. Verify all env vars are set
3. Test DATABASE_URL connection locally:
   ```bash
   DATABASE_URL="your-url" node server/index.mjs
   ```

### Images not loading
1. Check AWS credentials in Render env
2. Verify `AWS_ENDPOINT_URL_S3` is correct
3. Test direct S3 URL in browser
4. Check Neon bucket permissions (should be `public_read`)

### CORS errors
1. Verify `CORS_ORIGIN` matches frontend URL exactly
2. No trailing slash in URL
3. Include `https://` prefix
4. Redeploy backend after changing

### Database connection errors
1. Check `DATABASE_URL` format
2. Verify Neon database is active (not paused)
3. Check connection count in Neon dashboard
4. Use pooled URL (with `-pooler` suffix)

---

## 📝 Post-Deployment Tasks

1. **Test all features:**
   - User registration/login
   - Listing creation with photos
   - Photo upload/delete
   - Cart operations
   - Search functionality

2. **Monitor first 24 hours:**
   - Check for errors in logs
   - Monitor cold starts
   - Watch database connection usage

3. **Update documentation:**
   - Record your backend URL
   - Document any custom config
   - Share links with team

4. **Set up monitoring (optional):**
   - BetterUptime for uptime monitoring
   - Sentry for error tracking
   - LogTail for log aggregation

---

## 🎉 You're Live!

Your auction platform is now deployed with:
- ✅ Production PostgreSQL database (Neon)
- ✅ S3-compatible Object Storage (Neon)
- ✅ Serverless backend (Render)
- ✅ Frontend on edge network (Vercel)
- ✅ Auto-scaling infrastructure
- ✅ Zero configuration needed!

**Backend:** https://your-backend.onrender.com  
**Frontend:** https://your-frontend.vercel.app

---

## 📞 Support Resources

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Neon Docs:** https://neon.com/docs
- **Your Setup Summary:** `NEON-SETUP-SUMMARY.md`

---

**Ready to deploy?** Follow the steps above, and your platform will be live in ~10 minutes! 🚀
