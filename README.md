# 🏠 Pai-Pai

Ghar banane ka **pura hisaab** — pai-pai ka. Kharcha (material/labour/theka/architect/misc),
**cashbook** (cash-in-hand + bank balance, paisa kahan se aaya / kise gaya), aur **reports** —
sab ek jagah. Phone par app jaisa, kahin se bhi entry, **offline bhi chalega**, data **cloud me safe**.

> iPhone ke liye banaya gaya hai (Android/laptop par bhi chalega).
> **Live:** https://mohitkamboj309.github.io/pai-pai/ · **Hosting:** GitHub Pages.

---

## ✅ Ek baar ka setup (~15 min)

Bas 4 step. Aaram se karein, ek baar hi karna hai.

### Step 1 — Supabase (free cloud database)
1. [supabase.com](https://supabase.com) khol kar **free** account banayein (GitHub/email se).
2. **New project** banayein. Naam kuch bhi (jaise `ghar-kharcha`). Ek **database password**
   chuno (kahin likh lo). Region **Mumbai / Singapore** sabse paas.
3. Project ban-ne ke baad, left menu me **SQL Editor** → **New query** kholo.
4. Is folder ki file **`supabase-setup.sql`** ka pura text copy karke wahan paste karo →
   **Run** dabao. (Niche "Success" aa jaye to ho gaya.)

### Step 2 — Login email me 6-digit code on karein (zaroori)
Taaki login ke waqt email me **code** aaye (link nahi — iPhone app ke liye behtar):
1. Supabase me left menu → **Authentication** → **Emails** (ya **Email Templates**).
2. **Magic Link** template kholo. Uske HTML me kahin bhi ye line **add** kar do:
   ```
   <p>Aapka code: {{ .Token }}</p>
   ```
   (Jo `{{ .ConfirmationURL }}` wali line hai use rehne do, bas ye token wali line add karni hai.)
3. **Save**.

### Step 3 — App me apni keys daalein
1. Supabase me left menu → **Project Settings** (⚙️) → **API**.
2. Yahan se 2 cheez copy karni hai:
   - **Project URL** (jaise `https://abcd1234.supabase.co`)
   - **anon public** key (lambi `eyJ...` wali — *service_role* mat lena)
3. Ye dono app ke pehle screen (ya **Settings → Cloud**) me paste karke save kar dena.

### Step 4 — App ko phone par chalana (host)
App **GitHub Pages** par host hai (free) — live URL:
**https://mohitkamboj309.github.io/pai-pai/**

(Repo: https://github.com/mohitkamboj309/pai-pai — `git push` karte hi site apne aap update.)

### iPhone par install
1. Live URL **Safari** me kholo.
2. Email daalo → email me aaye **6-digit code** se login karo.
3. Safari me niche **Share** (⬆️) → **Add to Home Screen** → **Add**.
4. Ab home screen par 🏠 icon se app khulega — bilkul app jaisa.

---

## 📲 Roz ka use

- **Dashboard** par upar dikhега: **Cash haath me**, **Bank me**, kul kharcha, is mahine ka.
- 3 bade button:
  - **➖ Kharcha (Paisa Gaya)** — cement/sariya/kade/taar/mistry/theka/misc. Item, qty×rate
    (amount apne aap), kisse liya (vendor), kis account se, Cash/UPI/Net Banking/Online/Udhaar.
  - **➕ Paisa Aaya** — kahan se aaya (bank nikasi/salary/loan…), kis account me.
  - **🔁 Transfer** — jaise **bank se cash nikala**.
- **Entries** — sab dikhe, search/filter, edit/delete.
- **Reports** — kahan se aaya, kise/category/item-wise gaya, payment-mode wise, **theka kitna
  diya–kitna baaki**, **udhaar kiska kitna**, aur **CSV/Excel export**.
- **Theka** — har thekedar ka amount vs diya vs baaki.
- **Settings** — accounts (Cash/Bank) manage, backup, cloud config, logout.

### Khaas baatein
- **Offline:** reta/bajri lene gaye aur signal nahi? Entry phir bhi **save** hogi (upar
  "Offline/Sync" dikhega). Net aate hi apne aap cloud me chali jayegi.
- **Udhaar:** payment mode **Udhaar** chuno → wo "dena baaki" me dikhega; baad me entry khol
  kar **"Udhaar chukaya"** se paid mark kar do (account/cash kat jayega).
- **Unit (Sakda):** reta/bajri/mitti likhte hi unit apne aap **Sakda** ho jata hai — Qty = kitne
  sakde, Rate = per-sakda rate, amount apne aap (bori ka nahi). Cement → Bori, Sariya → Kg, etc.
  Unit khud bhi badal sakte ho.
- **Naye item/vendor** likhoge to wo apne aap suggestion me yaad ho jaate hain.
- **Backup:** Settings se kabhi bhi **JSON backup** ya **CSV** download kar lo.

---

## 🔁 App update karna
Code badle to repo me **`git push`** karo — GitHub Pages site apne aap update ho jati hai.
`sw.js` me `CACHE` version badha dene se (`pai-pai-v1` → `v2`) purana cache hat jata hai.

## 🔒 Privacy
Data sirf aapke Supabase project me hai, aur **Row-Level Security** se sirf aapke login ko
dikhta hai. anon key public ho to bhi koi aapka data nahi padh sakta (login zaroori).

## ❓ Dikkat aaye?
- "Code nahi aaya" → Step 2 (token line) check karo; spam folder dekho.
- "Login ke baad kuch save nahi" → Step 1 ka SQL dobara run karo (re-run safe hai).
- Balance galat? → Settings me account ka **opening balance** (shuru me kitna tha) sahi daalo.
