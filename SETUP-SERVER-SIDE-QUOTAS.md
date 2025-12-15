# Server-Side Quota System Setup Guide

## Overview
This implements **server-side** usage enforcement that cannot be bypassed by users. It uses:
- **Supabase RPC functions** for atomic daily quota tracking
- **IP rate limiting** for bot protection
- **Auth token validation** to verify logged-in users

---

## Step 1: Set Up Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/afqzpnwsxzhcffrrnyjw

2. Navigate to **SQL Editor**

3. Run the SQL from `supabase-usage-schema.sql`:
   - Creates `tryon_usage` table
   - Sets up Row Level Security (RLS)
   - Creates RPC function `check_and_increment_tryons`

4. Verify it worked:
   ```sql
   SELECT * FROM tryon_usage; -- Should exist (empty)
   SELECT check_and_increment_tryons(50); -- Should return JSON
   ```

---

## Step 2: Configure Vercel Environment Variables

Go to https://vercel.com/heltmos-projects/lippstick/settings/environment-variables

Add these variables (if not already present):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://afqzpnwsxzhcffrrnyjw.supabase.co` | Already set ✅ |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Already set ✅ |
| `DAILY_TRYON_LIMIT` | `50` | **NEW** - Set your desired daily limit |
| `REPLICATE_API_TOKEN` | Your Replicate token | Already set ✅ |

**Recommended limits:**
- Free users: 10-20 per day
- Paid users: 100-200 per day
- Start with 50 as a middle ground

---

## Step 3: Enable Google OAuth in Supabase

1. Go to Supabase → **Authentication** → **Providers**

2. Enable **Google** provider:
   - Get credentials from https://console.cloud.google.com/
   - Add redirect URI: `https://afqzpnwsxzhcffrrnyjw.supabase.co/auth/v1/callback`
   - Paste Client ID and Secret into Supabase

3. Test login on your site

---

## Step 4: Deploy and Test

1. Commit and push changes:
   ```bash
   git add .
   git commit -m "Add server-side quota enforcement"
   git push
   ```

2. Vercel will auto-deploy

3. Test the flow:
   - **Anonymous user**: Should hit IP rate limit (10/hour)
   - **Logged-in user**: Should hit daily limit (50/day)
   - Try bypassing via DevTools → Should still be blocked ✅

---

## How It Works

### For Anonymous Users:
```
User → Frontend → /api/generate
                     ↓
                  IP Rate Limit (10/hour)
                     ↓
                  Generate Image
```

### For Logged-In Users:
```
User → Frontend (sends auth token)
         ↓
     /api/generate
         ↓
     1. IP Rate Limit (10/hour)
         ↓
     2. Verify Auth Token
         ↓
     3. Supabase RPC: check_and_increment_tryons(50)
         ↓
     4. If allowed → Generate Image
        If exceeded → 429 Error
```

---

## Testing the System

### Test 1: Anonymous User
```bash
# Should work for first 10 requests/hour
curl -X POST https://lippstick.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"lipstickImage":"data:...","selfieImage":"data:..."}'

# 11th request should return 429
```

### Test 2: Logged-In User
```javascript
// In browser console while logged in:
const token = (await supabase.auth.getSession()).data.session.access_token;

for (let i = 0; i < 55; i++) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      lipstickImage: 'data:image/png;base64,...',
      selfieImage: 'data:image/png;base64,...'
    })
  });
  console.log(i, res.status); // Should get 429 after limit
}
```

### Test 3: Bypass Attempt (Should Fail)
```javascript
// Try to manipulate UI state
localStorage.setItem('freeTriesUsed', '0'); // Won't work
// Server still enforces limit via database ✅
```

---

## Monitoring Usage

### Check user usage in Supabase:
```sql
-- See all usage today
SELECT
  u.email,
  t.count,
  t.day
FROM tryon_usage t
JOIN auth.users u ON u.id = t.user_id
WHERE t.day = CURRENT_DATE
ORDER BY t.count DESC;
```

### Get total usage:
```sql
SELECT
  day,
  COUNT(*) as users,
  SUM(count) as total_tryons
FROM tryon_usage
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

---

## Adjusting Limits

### Change daily limit:
Update `DAILY_TRYON_LIMIT` in Vercel environment variables

### Change IP rate limit:
Edit `api/generate.ts`, line 33:
```typescript
maxRequests: 10, // Change this number
```

### Different limits for different users:
Modify the Supabase RPC function to check user role/plan:
```sql
-- Example: paid users get 200, free users get 20
create or replace function check_and_increment_tryons(daily_limit integer)
returns json
language plpgsql
security definer
as $$
declare
  user_limit integer;
begin
  -- Check if user has paid plan
  SELECT CASE
    WHEN subscription_status = 'active' THEN 200
    ELSE 20
  END INTO user_limit
  FROM user_subscriptions
  WHERE user_id = auth.uid();

  -- Rest of function...
end;
$$;
```

---

## Troubleshooting

### Error: "RPC function not found"
- Run the SQL schema again
- Check function exists: `SELECT * FROM pg_proc WHERE proname = 'check_and_increment_tryons';`

### Error: "Invalid authentication token"
- Check that frontend is sending `Authorization: Bearer <token>`
- Verify Supabase credentials in Vercel env vars

### Users hitting limit too quickly:
- Increase `DAILY_TRYON_LIMIT` in Vercel
- Check for bot traffic in usage table

### Quota not resetting daily:
- The RPC function uses UTC date
- Check `SELECT CURRENT_DATE;` in Supabase SQL editor

---

## Security Checklist

✅ Rate limiting enabled (IP-based)
✅ Daily quota enforced in database
✅ RLS policies prevent users from modifying others' data
✅ RPC function uses `security definer` for safe execution
✅ Auth tokens verified server-side
✅ Client-side UI is just UX, not security

---

## Next Steps (Optional)

1. **Add usage dashboard**: Show users their daily usage count
2. **Email notifications**: Warn users when approaching limit
3. **Premium tiers**: Different limits for free/paid users
4. **Analytics**: Track usage patterns to optimize limits
5. **Reset button**: Admin function to reset specific user's quota

