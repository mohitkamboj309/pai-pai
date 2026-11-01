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

### Step 2 — Login (email + password)
App me **email + password** se login hota hai. Pehli baar app me **"Naya account banao"** dabao.
Apna account ban jaane ke baad Supabase → **Authentication → Sign In / Providers** me
**"Allow new users to sign up"** band kar do — warna koi bhi public site se account bana sakta hai
(tumhara data phir bhi RLS se safe rehta hai, bas free quota bharta hai).

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
2. Email + password se login karo.
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
- **Entries** — din-wise list (har din ka kul kharcha upar), search (item, party, note, ₹ amount
  jaise `17000` / `17,000`, date/mahina jaise `oct` / `1 nov`), edit/delete.
  - **Filter:** "+ Filter" se date (Sab / Is mahina / Pichla / Custom), party, category, item, mode,
    account, type, Personal shamil ya nahi. Button pe pehle hi dikhta hai kitni entries aur kitna total.
  - **Tap-to-filter:** kisi bhi entry me party ke naam pe tap, entry detail me party/category/item/mode pe
    tap, Reports ki kisi row pe tap, Home ke Cash/Bank/Is mahine card pe tap → Entries usi filter ke saath.
    Upar chips ("Ram Mistry ✕") se ek-ek filter hatao ya "Saaf karo".
  - **Saved views:** filter laga ke "⭐ View save karo" → naam do → Entries me upar chip. Hatane ke liye
    ✏️ dabao (ya chip pe der tak dabao). Views sirf is phone pe save hote hain.
  - **⬇️ CSV** sirf wahi entries export karta hai jo filter me dikh rahi hain.
  - Entries se kahin aur jaake wapas aao to filter aur scroll wahin rehte hain.
- **Naya kharcha:** pehle **Amount**, phir **Kise diya** (party). Jaani-pehchaani party chunte hi uski
  aam category, aakhri item aur aakhri mode apne aap bhar jaate hain (jo tumne khud chuna wo nahi
  badalta). Thekedar ho to "🤝 theka chal raha hai → Theka Payment" sujhav, ek tap me theka link.
  Date hamesha dikhti hai (Aaj / Kal chips). Qty × Rate, note, account "+ Aur" me.
  - **Save + agla:** save karke turant agla form — date, party, mode wahi; amount/item/note khaali.
    (Paisa Aaya aur Transfer me bhi.)
- **Reports** — tabs: **Summary** (Aaya vs Gaya, ghar ka kharcha bina Personal, Personal alag, udhaar
  baaki, account balance, paisa kisse aaya), **Category**, **Party**, **Item** (kul qty, average rate,
  sabse kam–zyada rate, pehla → aakhri rate), **Mahina**. Upar date range (Sab / Is mahina / Pichla /
  Custom). Har row pe tap → uski entries. **CSV/Excel export** usi range ka.
- **Khata** — har party ka khata (thekedar, supplier, mistry). Upar **Kul dena baaki** (udhaar + theka
  baaki; advance nahi gina). Search + chips: Sab / Dena baaki / Udhaar / Theka / Supplier.
  Party pe tap: theka (rate list, measurement), side kaam ka udhaar + "Udhaar chukao", **poora ledger**
  (har entry, ∑ ab tak kul diya), **➕ Payment do**, **📜 Entries mein dekho**, aur
  **📤 WhatsApp pe hisaab** (text dekh/badal ke WhatsApp khulta hai — contact wahin chuno).
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
- **Khata tab:** har party (thekedar/vendor/supplier) ka hisaab ek jagah — theka kitna/diya/advance, aur
  side kaam ka udhaar alag. **"Udhaar chukao"** se ek hi baar me saara (ya kuch) udhaar chuk jaata
  hai — purani entries pehle, aadha diya to baaki udhaar me hi rehta hai. Chukane ki date entry me
  "Udhaar chukaya" ke roop me dikhti hai.
- **Theka advance:** diya > theka amount ho to "Advance (measurement baaki)" dikhta hai (galti nahi).
  Measurement ke baad theka amount update kar do.
- **Aaj ki labour (Home):** roz wale mistry/majdoor chips — 1 tap = 1 din, 2 tap = ½ din. Ek save me
  sab entries. Same din ki entry pehle se ho to app poochta hai.
- **Eint (Hazaar unit):** Qty me **poori ginti** (5000), Rate **per hazaar** (₹7600) → ₹38,000.
- **Personal category:** jo kharcha ghar banane ka nahi (jewellery, hospital…) — cash se katta hai par
  "Ghar ka kul kharcha" me nahi gina jaata.
- **Hisaab cleanup (Settings):** data me milne wali gadbad (vendor ki alag spelling, eint qty,
  galat category, double entry) ke **sujhav**. Tick karke Apply → pehle poora JSON backup download,
  phir badlav. **Undo** bhi Settings me. Amount kabhi nahi badalta.

---

## 🔁 App update karna
Code badle to repo me **`git push`** karo — GitHub Pages site apne aap update ho jati hai.
`sw.js` me `CACHE` version badha dene se (`pai-pai-v1` → `v2`) purana cache hat jata hai.

## 🔒 Privacy
Data sirf aapke Supabase project me hai, aur **Row-Level Security** se sirf aapke login ko
dikhta hai. anon key public ho to bhi koi aapka data nahi padh sakta (login zaroori).

## ❓ Dikkat aaye?
- "Login nahi ho raha" → email/password check karo; Supabase → Authentication → Users me user hai ya nahi dekho.
- "Login ke baad kuch save nahi" → Step 1 ka SQL dobara run karo (re-run safe hai).
- Balance galat? → Settings me account ka **opening balance** (shuru me kitna tha) sahi daalo.
