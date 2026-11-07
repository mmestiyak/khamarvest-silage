# Retention: turning one order into twelve

Owner-facing and internal. Silage is a monthly consumable: a cow eats 20 kg a
day, a 50 kg bag lasts two and a half days, and a two-cow farm buys about
24 bags a month. One customer who reorders is worth twelve first orders. The
site's job is to win the first order; this file is the part that keeps it.

## The number to watch

**Repeat rate** = customers with two or more orders ÷ all customers.

Today the Leads sheet records mediums as WhatsApp, ফোন কল or আগাম চাহিদা, but it
does not link an order to the previous one. Add one column, **আগের অর্ডার**,
and write the previous delivery date or "নতুন" when the order comes in. Ten
seconds per order, and after a month you can see the repeat rate and the average
days between orders. Nothing else in this file can be judged without it.

A workable first target is 60% repeat within 45 days. If the gap is longer than
that, the reminder below is arriving late, not the product.

## When to message

Work backwards from the bags the customer bought, not from a fixed calendar:

    বস্তা × ৫০ কেজি ÷ দৈনিক মোট কেজি = কত দিন চলবে

A farm that took 12 bags for one cow at 20 kg/day is covered for 30 days, so the
reminder goes on day 21. A farm that took 4 bags for a goat is covered much
longer; remind them later, not sooner.

## The four messages

Copy-paste Bengali, sent from the WhatsApp number the customer already has.
Keep them short and end with a question so a reply is easy.

**1. Day 3, quality check (the one that prevents a lost customer)**

> আসসালামু আলাইকুম। বস্তা খুলে গরুকে দিয়েছেন? গন্ধ, রং আর গরুর খাওয়া স্বাভাবিক আছে তো? কোনো সমস্যা মনে হলে ছবি পাঠাবেন, আমরা দেখে নিই।

Why: almost every complaint is visible on day one to three. Catching it here
costs one bag; catching it after a month costs the customer.

**2. Day 21, the reorder (the one that produces revenue)**

> আসসালামু আলাইকুম। আপনার নেওয়া বস্তাগুলো প্রায় শেষের দিকে। এই মাসে কত বস্তা লাগবে বলবেন? আগের মতো একই ঠিকানায় পাঠিয়ে দিই।

Why: a question about bags, not "are you interested". It assumes the answer is
a number. No discount, no urgency: the price is the same all year, and inventing
a deadline is the fastest way to lose trust.

**3. Day 30, only if there was no reply**

> আসসালামু আলাইকুম। গতবার জানতে চেয়েছিলাম, সাইলেজের বস্তা কি শেষ হয়েছে? কত বস্তা লাগবে জানালে এই সপ্তাহে পাঠানোর ব্যবস্থা দেখি।

Why: one follow-up, then stop. Two unanswered messages are enough.

**4. Second order complete, ask for the two things that compound**

- A Google review, once the Business Profile share-link is available (see
  `GMB_SETUP.md`; the profile currently has no reviews at all).
- A photo of the cattle eating, with permission to use it. Real photos are the
  one trust signal competitors cannot copy, and the site has only four.

## Seasonal overlay

- **Qurbani:** 45 days before Eid, message every customer who bought fattening
  cattle. The feed plan changes and the order is larger.
- **Winter (December-February):** grass growth stops; message everyone who has
  not ordered in 30 days.
- **Monsoon:** wet grass and bloat risk; the bloat guide is the useful thing to
  send, not a sales message.

## What not to do

- No "স্টক শেষ" or "দাম বাড়বে" messages. The price is the same all year, and the
  checker rejects that framing on the site; the same rule should hold on WhatsApp.
- No bulk broadcast to people who never ordered. In this market that is how a
  number gets blocked.
- No advance payment. Cash or transfer on delivery, always.
