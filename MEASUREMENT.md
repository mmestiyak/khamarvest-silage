# Measurement: what to watch, and where

Owner-facing. The site sends events to GA4 (`G-4SVWY8JWBX`); this file says
which ones answer a business question, where each fires, and the ten-minute
routine that turns them into decisions. Nothing here changes what visitors see.

## The one thing that was missing

A GA4 snapshot for 9 Aug to 6 Nov 2026 showed 582 active users and 7,595
events, but no key-event table. Without that, a visit cannot be tied to a
WhatsApp tap, a call, or a saved lead, so every "should we write more guides"
question is answered by traffic instead of leads.

**Fix, in GA4 (five minutes, once):** Admin > Data display > Events > mark these
as key events. They already fire; this only tells GA4 they matter.

| Key event | Fires when | Where in code |
|---|---|---|
| `whatsapp_click` | any `wa.me` link, plus the homepage order form | `js/ga.js`, inline in `index.html` |
| `phone_click` | any `tel:` link | `js/ga.js`, inline in `index.html` |
| `order_details_submitted` | order form, callback box, advance-booking form | `js/leads.js`, inline in `index.html` |
| `calculator_order_click` | a calculator hands over to WhatsApp | `js/ga.js`, tool pages |
| `ai_referral` | the visit arrived from an AI assistant | `js/ga.js`, inline in `index.html` |

`calculator_use` and `video_play` are useful but not leads; leave them as normal
events so they do not dilute the conversion report.

## Reading it

- **Which page earns leads:** Explorations > Free form. Dimension `page_path`,
  metric `whatsapp_click` + `phone_click` + `order_details_submitted`. A page
  with traffic but no taps has a conversion problem, not a traffic problem.
- **Which CTA works:** dimension `link_location`. Every button already reports
  one (`hero`, `price`, `steps`, `bottom`, `sticky_bar`, `order_form`,
  `next_step`, `article_body`, `footer`).
- **Which assistant sends farmers:** dimension `ai_source` (`chatgpt`,
  `perplexity`, `copilot`, `gemini`, `claude`, `meta_ai`, `you`). The source is
  kept in `sessionStorage`, so every later event in the same session carries it
  and a WhatsApp tap can be attributed to the assistant that sent the farmer.
- **Which guide an assistant cites:** compare `ai_source` against `page_path`
  on `ai_referral`. Update those guides first; they are already being quoted.

## The monthly ten minutes

1. Set the date range to the last 28 days.
2. Key events by `page_path`, sorted by total.
3. Note the three pages with the most key events and the three with the most
   sessions but no key event.
4. For the second group, check one thing on the page: is there a WhatsApp and
   a call button within the first two phone screens? If not, that is the fix.
5. Compare `ai_source` this month against last month. If ChatGPT grows, the
   sourced-guide format is working and should not be diluted.

## Traps in the data

- **Data-centre traffic is not people.** Lulea, Prineville, Boardman, Ashburn,
  Dublin and Groningen in the city report are Meta/Google/AWS ranges. In the
  Aug-Nov snapshot roughly 40-50 of 582 users were this kind of traffic.
- **Old titles are history, not current pages.** Page titles recorded before
  the 30 September 2026 price change still say `১০ টাকা`; GA4 stores the title
  as it was at the time of the visit. Do not read them as current rankings.
- **GA4 has no impressions.** Position and CTR only exist in Search Console.
  Ask for the Performance export (Queries and Pages, last 3 months) when the
  question is "what should we write next", not "what should we fix".
- **`localhost` referrals** in the session report are local previews, not users.

## What is deliberately not tracked

No phone number, name or message text is sent to GA4. Form values go only to
the owner's Apps Script sheet. A WhatsApp or phone lead itself has no phone
number in GA4, so the Leads tab in the sheet is still the count of real orders.
