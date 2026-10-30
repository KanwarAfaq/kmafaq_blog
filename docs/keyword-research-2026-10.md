# Keyword research, October 2026

Source: SE Ranking keyword metrics, queried 2026-10-30. Databases: `pk` (Pakistan) and `us`. Volume is monthly searches; difficulty is 0-100 (SE Ranking KD). "No data" means the database returned nothing for that exact phrase, not that demand is proven zero. Intent: I informational, C commercial, L local, N navigational.

Context: kmafaq.online had 0 organic keywords and 0 backlinks in SE Ranking before this work, so only low-difficulty terms are realistic near term.

## Findings table

| Keyword | Source | Volume | Difficulty | Intent | Suggested page |
|---|---|---|---|---|---|
| business directory pakistan | pk | 480 | 28 | I | /business |
| business listing pakistan | pk | 480 | 15 | I | /business |
| pakistan business listing | pk | 480 | 20 | I | /business |
| business directory | pk | 480 | 26 | I, N | /business |
| business directory | us | 2,900 | 66 | I | /business (too hard for now) |
| yellow pages pakistan | pk | 390 | 15 | I | /business |
| ai jobs | pk | 540 | 38 | I | /jobs |
| ai jobs in pakistan | pk | 390 | 11 | I | /jobs |
| artificial intelligence scope in pakistan | pk | 260 | 18 | I | new blog article |
| machine learning engineer jobs | pk | 260 | 19 | I | /jobs |
| ai jobs in karachi | pk | 140 | 10 | I | /jobs |
| artificial intelligence jobs in pakistan | pk | 50 | 11 | I | /jobs |
| ai tools directory | us | 330 | 44 | I | /tools |
| ai tools | us | 33,100 | 85 | I | too hard |
| ai tools | pk | 9,900 | 98 | I | too hard |
| ai automation | us | 8,100 | 68 | I | /services, blog |
| ai automation | pk | 2,400 | 98 | I | too hard |
| ai agents | pk | 2,400 | 99 | I | too hard |
| automation tools | pk | 390 | 91 | I | too hard |
| n8n tutorial | pk | 90 | 59 | I | blog |
| n8n tutorial | us | 20 | 31 | I | blog (low demand) |
| web development | pk | 14,800 | 77 | L, C | too hard |
| web development course | pk | 1,800 | 72 | L, C | skip |
| web development services | us | 5,400 | 58 | L, C | /services (CPC 10.23 USD) |
| remote jobs | pk | 18,100 | 100 | I | too hard |
| remote jobs in pakistan | pk | 6,600 | 93 | I | too hard |
| jobs in pakistan | pk | 8,000 | 89 | I | too hard |
| online jobs in pakistan | pk | 14,800 | 99 | I | too hard |
| freelance jobs | pk | 1,300 | 90 | I | too hard |
| freelancing in pakistan | pk | 20 | 23 | I | skip |
| it jobs in pakistan | pk | 10 | 18 | I | skip |
| online earning in pakistan | pk | 18,100 | 87 | I | too hard |
| make money online in pakistan | pk | 210 | 20 | I | blog |
| how to earn money online in pakistan without investment | pk | 590 | 8 | I | blog |
| how to earn money in pakistan | pk | 480 | 10 | I | blog |
| free online earning in pakistan | pk | 480 | 8 | I | blog |
| چیٹ جی پی ٹی | pk | 50 | 16 | I | Urdu blog |
| urdu ai tools, chatgpt urdu, chatgpt in urdu, ai tools in urdu, ai kya hai, ai tools for students | pk | no data | n/a | n/a | n/a |
| اے آئی ٹولز, مصنوعی ذہانت, ویب ڈویلپمنٹ, فری لانسنگ, آن لائن کمائی, گھر بیٹھے کمائی, ملازمتیں | pk | no data | n/a | n/a | n/a |
| urdu ai tools, chatgpt urdu, urdu blog | us | no data | n/a | n/a | n/a |
| web development jobs in pakistan | pk | no data | n/a | n/a | n/a |

## Conclusions

- Generic head terms (ai tools, ai agents, web development, remote jobs, online jobs in pakistan) have high volume but KD 77-100. Not winnable for a site with no backlinks.
- Urdu-script queries return no data in SE Ranking, so Urdu demand cannot be sized with this tool. Use Google Search Console impressions on the existing Urdu articles instead. Do not infer that Urdu demand is zero.
- Best fits for existing pages: business directory and listing phrases (KD 15-28, about 480 each) for /business; AI jobs in Pakistan phrases (KD 10-18) for /jobs; "ai tools directory" (US 330, KD 44) for /tools.
- Pakistan earning queries without investment are low difficulty (KD 8-10, 480-590) but are crowded intent; they need an honest, sourced article.
- "n8n tutorial" has 90 monthly searches in Pakistan and 20 in the US. Demand exists but is small.
- Volumes are SE Ranking estimates and some series are erratic (for example "it jobs in pakistan" fell from 590 to 10, "urdu news" in the US swings between 70 and 5,400).

## On-page changes made from this data

| Page | Target phrases | Changes |
|---|---|---|
| /business | business directory, business listing | New title, description, H1, FAQ with FAQPage JSON-LD, internal links to pricing, jobs, services |
| /jobs | ai jobs, remote and freelance jobs | New title, description, H1, FAQ with FAQPage JSON-LD, internal links |
| /tools | ai tools directory | New title, description, H1, FAQ with FAQPage JSON-LD, internal links |

Page copy deliberately avoids claims about listing counts, Pakistan coverage or rankings, because the repo cannot verify them. The title and description for these pages also had to change in `scripts/generate-seo.mjs`, which feeds the prerendered HTML.

## Suggested next content

1. Article: how to earn online in Pakistan without investment (sourced, honest about limits).
2. Article: scope of artificial intelligence in Pakistan, linking to /jobs.
3. n8n tutorial from the author's own hands-on experience.
4. Check Search Console for Urdu queries before committing to Urdu topics.
