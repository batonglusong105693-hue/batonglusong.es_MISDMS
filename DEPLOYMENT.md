# MISDMS-BLES Setup & Deployment Guide

**Last Updated:** August 23, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Email Configuration](#email-configuration)
4. [Deployment](#deployment)
5. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Node.js 20.9+ and npm
- PostgreSQL 14+
- XAMPP or equivalent local environment

### Installation (5 minutes)

```bash
# Clone repository
git clone <repo-url>
cd misdms_bles

# Install dependencies
npm install

# Setup database
npx prisma migrate deploy

# Create .env.local from template
cp .env.example .env.local

# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to NEXTAUTH_SECRET in .env.local

# Start development server
npm run dev
```

Visit: http://localhost:3000

---

## Environment Setup

### 1. Database Connection

**XAMPP (Local Development):**
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/misdms_bles?schema=public"
```

**Remote PostgreSQL:**
```
DATABASE_URL="postgresql://username:password@host:5432/misdms_bles?schema=public"
```

### 2. Authentication Keys

Generate secure random keys:

```bash
# NEXTAUTH_SECRET (32+ chars, hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_SECRET (32+ chars, hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Production Environment Setup

Use a secure PostgreSQL connection string for the app environment variables. Vercel should use Node.js 20.9 or newer, as required by Next.js 16. For Supabase or similar managed databases, configure:

```env
DATABASE_URL=<your-database-connection-string>
DIRECT_URL=<your-direct-database-connection-string>
NEXTAUTH_SECRET=<random secret>
JWT_SECRET=<random secret>
NEXTAUTH_URL=https://<your-domain>
AUTH_URL=https://<your-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_STORAGE_BUCKET=dms-files
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=dms-files
```

Create a **private** Supabase Storage bucket named `dms-files`. Never expose the service role key to the browser or commit it to source control. The application uploads files directly to Supabase with short-lived signed upload URLs and serves them through authenticated application routes.

For a new Supabase project, apply the Prisma schema once from a trusted local machine, then use migrations for future changes:

1. Set `DATABASE_URL` to Supabase's pooled connection string and `DIRECT_URL` to its direct connection string.
2. Run `npx prisma db push` once for the initial schema, or create a migration with `npx prisma migrate dev` and deploy it with `npx prisma migrate deploy`.
3. Run `SEED_DATABASE=true npx tsx prisma/seed.ts` only when intentionally initializing an empty database.
4. Run `npm run build` before deploying.

Do not run the seed command automatically on every Vercel build. Do not use `SEED_DATABASE_FORCE=true` in production.

The seed is idempotent for redeployments: once users exist, later deployments skip the demo data instead of deleting live records. Do not set `SEED_DATABASE_FORCE=true` on a production project because it intentionally recreates demo records and can overwrite the database flow.

### 4. Application URLs

```env
# Development
NEXTAUTH_URL="http://localhost:3000"

# Production
NEXTAUTH_URL="https://yourdomain.com"
```

---

## Email Configuration

### Option 1: Disabled (Default - XAMPP)

```env
EMAIL_ENABLED=false
EMAIL_PROVIDER=none
```

**Result:** All emails logged to console. Perfect for XAMPP development.

### Option 2: Mailtrap (Testing)

Free service that captures emails without sending. Perfect for staging/testing.

1. Sign up at https://mailtrap.io
2. Create inbox and get SMTP credentials
3. Configure:

```env
EMAIL_ENABLED=false  # Keep false for testing - use web UI to view
EMAIL_PROVIDER=mailtrap
SMTP_HOST=live.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
```

4. View captured emails at mailtrap.io dashboard

### Option 3: Gmail SMTP (Production-Ready)

1. Enable 2-factor authentication in Google Account
2. Create App Password: https://myaccount.google.com/apppasswords
3. Configure:

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

### Option 4: SendGrid (Recommended for Production)

1. Sign up at https://sendgrid.com
2. Create API key: Settings → API Keys → Create Key
3. Configure:

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@school.edu
```

4. Install SDK:
```bash
npm install @sendgrid/mail
```

### Option 5: Custom SMTP Server

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@school.edu
```

---

## Deployment

### Step 1: Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security scan completed
- [ ] Database backups created
- [ ] Environment variables configured
- [ ] Email service setup (optional)
- [ ] Dependencies updated

### Step 2: Build for Production

```bash
# Build application
npm run build

# Test production build locally
npm run start
```

### Step 3: Deploy to Hosting

#### Other Platforms (AWS, DigitalOcean, Railway, Render, Heroku)

```bash
# Build Docker image
docker build -t misdms-bles .

# Push to registry and deploy
```

### Step 4: Post-Deployment

- [ ] Verify health check endpoint
- [ ] Test core workflows
- [ ] Monitor error logs
- [ ] Confirm email delivery (if enabled)
- [ ] Test backups work
- [ ] Document deployment details

---

## Features & Status

### Phase 1: Core (100% ✅)
- ✅ Attendance Management
- ✅ Pagination System
- ✅ Reports (SF1, SF2)
- ✅ Settings Management

### Phase 2: High-Priority (100% ✅)
- ✅ Audit Logging
- ✅ File Upload
- ✅ Email Notifications (configurable)
- ✅ User Profiles
- ✅ Data Export

### Phase 3: Advanced (100% ✅)
- ✅ Backup & Recovery
- ✅ Advanced Search
- ✅ Report Customization
- ✅ Grade Workflow
- ✅ Analytics Dashboard
- ✅ Alerts System

### Phase 4: Production (100% ✅)
- ✅ Performance Optimization
- ✅ Security Hardening
- ✅ Deployment Checklist
- ✅ API Documentation

---

## Troubleshooting

### Email Not Sending

**Problem:** Emails in logs but not received

**Solutions:**
1. Check `EMAIL_ENABLED=true` in .env.local
2. Verify SMTP credentials
3. Check spam/junk folder
4. Review provider logs (Gmail, SendGrid, etc.)
5. Confirm firewall allows outbound port 587/465

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions:**
1. Ensure MySQL/MariaDB is running
2. Check DATABASE_URL in .env.local
3. Verify username and password
4. Create database: `CREATE DATABASE misdms_bles;`

### Application Won't Start

```
Error: NEXT_PUBLIC_* env variables
```

**Solutions:**
1. Copy .env.example to .env.local
2. Fill in all required values
3. Restart development server
4. Clear .next directory: `rm -rf .next`

### Slow Performance

**Solutions:**
1. Enable database query caching
2. Add database indexes
3. Implement response compression
4. Use CDN for static assets
5. Check deployment resources (CPU, RAM)

---

## API Documentation

- **Docs Portal:** `/docs` (in-app interactive reference)
- **OpenAPI Spec:** `/api/openapi.json`
- **Endpoints:** 35+ production APIs
- **Authentication:** JWT Bearer tokens

### Quick API Test

```bash
# Get JWT token (from login)
TOKEN=$(curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"password"}' \
  | jq -r '.token')

# Test protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/students
```

---

## Support & Resources

- **Documentation:** `/docs` in app
- **Code Examples:** JavaScript, Python, cURL
- **Issue Tracker:** GitHub Issues
- **Community:** GitHub Discussions

---

## Security Notes

- Change default admin credentials immediately
- Use HTTPS in production (enforced in .env)
- Rotate JWT secrets regularly
- Enable automated backups
- Monitor audit logs weekly
- Keep dependencies updated

---

## License

© 2026 MISDMS-BLES. All rights reserved.

**Build Date:** August 23, 2026  
**Last Updated:** August 23, 2026
