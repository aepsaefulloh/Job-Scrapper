Tambahkan flow setelah user menjalankan pencarian lowongan.

Setelah tombol **Search Jobs Now** dijalankan dan backend berhasil membuat search execution/scrape run, frontend harus langsung mengarahkan user ke halaman khusus untuk memantau proses yang sedang berjalan.

Gunakan halaman level search execution, bukan hanya individual provider run, terutama karena satu pencarian dapat menghasilkan beberapa source dan beberapa search intent.

Preferred route:

```text id="ndq8qu"
/search-runs/:id
```

Jika backend saat ini belum memiliki parent search execution ID, buat abstraction paling sederhana yang dapat mengelompokkan seluruh child `scrape_runs` dari satu aksi **Search Jobs Now**.

Jangan membuat workflow/job-system baru yang terlalu kompleks.

---

# Main Flow

Desired UX:

```text id="5gg8wf"
Jobs
↓
Search Jobs Now
↓
POST /api/search/run
↓
Search execution created
↓
Redirect /search-runs/:id
↓
Live Progress
↓
Source Processing
↓
Normalization / Filtering
↓
AI Processing
↓
Matching
↓
Completed / Partial / Failed
↓
View Jobs / Recommendations
```

Tujuan utamanya adalah agar user dapat memahami apa yang sedang dikerjakan oleh Personal Job Agent tanpa perlu melihat terminal log.

---

# 1. Search Run Detail Page

Buat halaman:

```text id="6v4nuw"
/search-runs/:id
```

Page title dapat berupa:

```text id="cvoc3j"
Job Search Run
```

atau:

```text id="hwou0y"
Search Progress
```

Gunakan visual language JobToolkit yang sudah ada:

- compact
- restrained
- editorial
- professional
- clear hierarchy
- functional
- no generic AI SaaS styling

Hindari:

- glowing progress indicator
- gradient AI cards
- fake charts
- fake percentages
- excessive animation
- oversized status cards

---

# 2. Main Run Status

Di bagian atas tampilkan status utama.

Supported state:

```text id="9meesn"
Preparing
Searching
Processing
Matching
Completed
Partial
Failed
```

Jika backend menggunakan status internal yang berbeda, map ke user-facing state secara deterministic.

Contoh:

```text id="cqxo2t"
Search Progress

Running

Started 10:31:08
Elapsed 1m 24s
```

Setelah selesai:

```text id="oyphwp"
Completed

Started   10:31:08
Finished  10:32:42
Duration  1m 34s
```

Durasi harus dihitung dari actual timestamps.

Saat run aktif, elapsed duration boleh diperbarui di frontend menggunakan `startedAt`.

Jangan menyimpan timer sebagai source of truth.

---

# 3. Real Progress Only

Jangan menggunakan progress percentage seperti:

```text id="gmlhjb"
72%
```

kecuali backend benar-benar mengetahui total unit kerja dan completed unit secara akurat.

Gunakan stage-based progress.

Example:

```text id="4ncz4w"
✓ Search initialized

✓ Jobstreet search completed

● Loker.id search running

○ Normalization

○ Freshness filtering

○ Matching

○ Finalizing
```

State:

```text id="kmd7vi"
completed
running
pending
failed
```

Gunakan persisted backend state sejauh tersedia.

---

# 4. Multi-Source Visibility

Tampilkan masing-masing source secara terpisah.

Example:

```text id="dxwx60"
Sources

Jobstreet
Completed
18 discovered
12 new
3 duplicates
Duration 43s

Loker.id
Running
9 discovered
5 new
Duration 27s
```

Jika satu source berhasil dan source lain gagal:

```text id="94xc8w"
Jobstreet   Completed
Loker.id    Failed
```

overall execution harus menjadi:

```text id="g2eyv6"
Partial
```

bukan `Completed`.

---

# 5. Search Intent Visibility

Tampilkan search intent yang dijalankan agar user tahu agent mencari apa.

Example:

```text id="jnunyy"
Search Intents

Frontend Engineer
Vue Developer
Fullstack Engineer
```

Location:

```text id="lkik29"
Jakarta
Bogor
Remote
```

Jangan tampilkan seluruh Candidate Profile atau CV.

Hanya tampilkan safe search information.

---

# 6. Search Preferences Metadata

Tambahkan section:

```text id="c4qm55"
Search Settings
```

Possible content:

```text id="6xnjif"
Sources          Jobstreet, Loker.id
Locations        Jakarta, Bogor
Posted within    Last 7 days
Work mode        Remote, Hybrid
Employment       Full-time
Triggered by     Manual
Max pages        1
```

Gunakan actual persisted settings yang dipakai ketika execution dimulai.

Jika memungkinkan, snapshot safe search preferences saat search dimulai agar detail run tetap akurat walaupun user mengubah preference setelah itu.

---

# 7. Processing Summary

Tambahkan ringkasan proses:

```text id="5xziia"
Processing Summary

Discovered             42
New jobs               25
Updated                  3
Duplicates               7
Too old                  5
Failed                    2
Sent to matching         20
Recommended              11
```

Hanya tampilkan metric yang benar-benar tersedia.

Jangan membuat angka estimasi atau menghitung dengan rumus yang tidak reliable.

---

# 8. AI Processing Visibility

Tambahkan visibility khusus untuk pekerjaan yang benar-benar diproses oleh AI.

Tujuan:

user bisa membedakan:

```text id="jgqtir"
raw scraped data
```

dengan:

```text id="ovk9dv"
AI processed / AI assisted result
```

Gunakan label/icon AI yang kecil dan restrained.

Example label:

```text id="q6f9dy"
✦ AI
```

atau icon kecil dengan tooltip:

```text id="nq05h8"
AI processed
```

Jangan menggunakan icon AI sebagai dekorasi.

Icon/label hanya muncul jika field/result benar-benar diproses AI.

---

# 9. AI Processing Stage

Tambahkan stage apabila AI processing memang terjadi.

Example:

```text id="gxpkpz"
Processing

✓ Jobs normalized
✓ Freshness filter
✓ Skills extracted
● AI matching
○ Recommendation finalization
```

Atau:

```text id="fudq27"
AI Processing

12 / 20 jobs evaluated
```

hanya jika backend memang memiliki count tersebut.

Jika backend tidak tahu progress numerik:

```text id="am4etl"
AI Matching
Running
```

lebih baik daripada fake percentage.

---

# 10. AI-Corrected / AI-Enriched Job Data

Jika sistem melakukan koreksi atau enrichment menggunakan AI, buat perubahan tersebut visible di UI.

Contoh job:

```text id="nukgrr"
Frontend Enginer
```

jika source raw kemudian AI memperbaiki menjadi:

```text id="7cc898"
Frontend Engineer
```

UI dapat menunjukkan:

```text id="hhr9ch"
Frontend Engineer   ✦ AI
```

dan jika user membuka detail:

```text id="147fkn"
AI assisted normalization
Original: Frontend Enginer
```

Namun jangan tampilkan raw value di list jika membuat UI terlalu penuh.

Raw/original dapat tersedia melalui detail/popover.

---

# 11. AI Label Rules

Gunakan AI label hanya untuk hasil seperti:

- AI-evaluated matching
- AI-generated recommendation
- AI-extracted skill jika benar-benar menggunakan LLM
- AI-generated job summary
- AI-normalized field jika memang LLM melakukan koreksi
- AI-generated application material nanti

Jangan beri label AI pada proses deterministic seperti:

- URL normalization
- lowercase normalization
- date parsing
- duplicate checksum
- freshness filter
- role alias registry
- location normalization
- deterministic parser

Untuk deterministic processing, jangan gunakan badge AI.

---

# 12. Example Job Processing Detail

Jika user membuka salah satu job dari Run Detail, UI dapat menampilkan:

```text id="uhlnyw"
Processing

Source              Loker.id
Original title      Finance Staff
Normalized title    Finance Staff
Published           2 days ago
Freshness           Passed
Eligibility         Passed

Skills
Excel
Tax
Financial Reporting

Match score          84%
AI evaluation        Completed ✦ AI
```

Jika AI menghasilkan recommendation:

```text id="mr91jg"
Why this matches   ✦ AI

Strong alignment with financial reporting,
tax handling, and spreadsheet experience.
```

Pastikan rekomendasi tetap berasal dari backend existing matching result.

Frontend tidak boleh membuat explanation sendiri.

---

# 13. AI Correction Audit

Jika memungkinkan tanpa schema yang terlalu kompleks, simpan metadata minimal mengenai AI transformation.

Example:

```ts id="65gatd"
type AiProcessingMetadata = {
  processed: boolean;
  provider?: string;
  model?: string;
  processingType?: string;
  processedAt?: string;
};
```

Namun jangan expose:

- prompt lengkap
- API credentials
- internal chain of thought
- provider raw response

User hanya perlu tahu:

```text id="p34ycp"
processed by AI
what type of processing occurred
when it occurred
```

Provider/model boleh tetap internal jika tidak ada kebutuhan product-facing.

---

# 14. AI Processing Summary

Di Run Detail tambahkan section kecil:

```text id="puuw4x"
AI Processing

20 jobs sent for evaluation
18 completed
2 failed
```

Jika ada failure:

```text id="96p6rn"
2 jobs could not be evaluated by AI.
The jobs were still saved.
```

AI failure tidak boleh otomatis berarti scraping failure.

Pisahkan:

```text id="dgb0jj"
Scraping
```

dari:

```text id="dj44kb"
AI Processing
```

---

# 15. Event Timeline

Tambahkan timeline sederhana berdasarkan event/state nyata.

Example:

```text id="0s73sy"
Run Timeline

10:31:08
Search started

10:31:14
Jobstreet search started

10:31:37
18 jobs discovered

10:31:51
Loker.id completed

10:31:58
Freshness filtering completed

10:32:12
Matching started       ✦ AI

10:32:42
Search completed
```

Jangan membangun log viewer.

Timeline adalah user-facing operational history.

Gunakan event yang aman dan relevan saja.

---

# 16. Polling

Saat execution aktif:

frontend boleh polling API run status.

Recommended:

```text id="kk37wa"
2–3 seconds
```

Polling berhenti ketika execution mencapai:

```text id="g7aa3f"
completed
partial
failed
```

Jangan polling selamanya.

Pastikan cleanup polling saat component unmount.

---

# 17. Persistence

Run progress page harus tetap bisa dibuka setelah proses selesai.

Contoh:

```text id="nrtmr9"
/search-runs/<id>
```

harus tetap menunjukkan hasil historical execution.

Jangan hanya menyimpan progress di frontend memory.

Backend/persisted state adalah source of truth.

---

# 18. Refresh Safety

Jika user refresh browser ketika search masih berjalan:

```text id="6pgb8g"
refresh page
↓
GET execution
↓
recover current state
↓
continue polling
```

User tidak boleh kehilangan progress hanya karena reload.

---

# 19. Search History Link

Existing Recent Searches harus dapat diklik.

Example:

```text id="mhviky"
Recent Searches

Today 10:31
Completed
21 new
→ View run
```

Klik membuka:

```text id="03cp9r"
/search-runs/:id
```

---

# 20. Completion Actions

Setelah selesai, tampilkan:

```text id="q5thz9"
View New Jobs
View Recommendations
Back to Jobs
```

Jika memungkinkan:

```text id="f4ojsq"
View 12 Recommended Jobs
```

Gunakan filter berdasarkan execution/run apabila data relationship tersedia.

Jangan membuat filter palsu jika jobs belum dapat dikaitkan ke execution secara reliable.

---

# 21. Completed Empty State

Jika pencarian sukses tetapi tidak ada lowongan baru:

```text id="ep829f"
Search completed

No new jobs matched the current search preferences.
```

Tetap tunjukkan:

- duration
- source status
- discovered count
- filter counts

---

# 22. Partial State

Jika sebagian pipeline gagal:

```text id="y3vqid"
Search partially completed.

Some sources or jobs could not be processed,
but successful results were saved.
```

Tunjukkan section yang gagal.

Example:

```text id="m0x0nr"
Jobstreet
Completed

Loker.id
Failed
LOKER_ID_SEARCH_FAILED

AI Matching
Completed
```

Jangan menunjukkan raw stack trace.

---

# 23. Failure State

Jika seluruh execution gagal:

```text id="03kk42"
Search failed

No jobs could be processed from the selected sources.
```

Tampilkan safe error code/message jika tersedia.

Action:

```text id="tkspj0"
Try Again
Back to Jobs
```

---

# 24. Backend Execution Model

Jika satu `POST /api/search/run` menghasilkan banyak child `scrape_runs`, introduce a lightweight parent execution concept if not already available.

Possible model:

```text id="szupgs"
search_executions
```

Fields may include:

```text id="ivqxhz"
id
candidate_id
status
trigger
started_at
finished_at
preferences_snapshot
created_at
```

Child:

```text id="h2ue6p"
scrape_runs.search_execution_id
```

Do this only if necessary to reliably group:

```text id="0nfcec"
one user action
→ many source/query runs
```

Keep the implementation lightweight.

---

# 25. Search Execution API

If parent execution is implemented, expose:

```http id="np1n56"
GET /api/search-runs/:id
```

Response may include:

```json id="m0a2fx"
{
  "id": "...",
  "status": "running",
  "trigger": "manual",
  "startedAt": "...",
  "finishedAt": null,
  "preferences": {},
  "summary": {},
  "sources": [],
  "stages": []
}
```

Frontend should consume one cohesive endpoint where practical.

Avoid requiring many unrelated requests to reconstruct the page.

---

# 26. Security

All search execution/run queries must remain candidate-scoped.

Do not expose:

- another candidate's run
- token
- cookie
- session state
- raw candidate CV
- raw AI prompt
- provider API credentials
- browser storage
- internal stack traces

---

# 27. Tests

Add backend tests for:

- create search execution
- child scrape run grouping
- candidate ownership
- running state
- completed state
- partial state
- failed state
- duration timestamps
- safe metadata
- AI processing metadata
- persistence after completion

Add frontend tests for:

- redirect after Search Jobs Now
- run page loading
- active polling
- polling cleanup
- browser refresh recovery
- multi-source rendering
- stage rendering
- running duration
- completion actions
- partial failure
- AI badge rendering
- AI badge NOT rendered for deterministic processing
- historical run viewing

---

# 28. Important AI UX Rule

The AI indicator must communicate provenance, not marketing.

Good:

```text id="n22m55"
Match evaluation   ✦ AI
```

Good:

```text id="3l3cgx"
Summary   ✦ AI
```

Bad:

```text id="j5e3wv"
✨ AI Powered Smart Intelligent Job Magic
```

Keep the label subtle.

Suggested UI:

```text id="gg6ew0"
✦ AI
```

or a small monochrome AI icon plus tooltip:

```text id="py2ybf"
Processed with AI
```

---

# 29. Do Not Implement

Do not implement in this milestone:

- Assisted Apply
- Auto Apply
- Glints
- LinkedIn
- full developer log viewer
- raw AI prompt viewer
- raw browser event viewer
- fake progress percentage
- notification system
- Redis
- BullMQ
- Docker

---

# Completion Criteria

This milestone is COMPLETE when:

- clicking Search Jobs Now redirects to `/search-runs/:id`
- the run page survives reload
- current status is visible
- elapsed/final duration is visible
- source-level progress is visible
- safe search metadata is visible
- search preferences used by the run are visible
- real processing stages are visible
- recent runs link to their detail page
- multi-source partial states work correctly
- job counts are based on real persisted data
- AI processing is clearly distinguishable with a subtle AI label/icon
- deterministic processing is NOT incorrectly labeled AI
- AI processing failure is separated from scraping failure
- completion actions are available
- terminal logs are not required for normal monitoring
- backend tests pass
- frontend tests pass
- typecheck passes
- production build passes

Do not return with partial progress unless there is a concrete external blocker.

Final report must include:

1. run/execution data model
2. redirect behavior
3. progress/status behavior
4. duration calculation
5. source-level progress
6. metadata shown
7. AI provenance implementation
8. AI-corrected/enriched field behavior
9. event timeline behavior
10. refresh/recovery behavior
11. backend/frontend test counts
12. typecheck/build result
13. screenshots or description of the final Run Detail UI