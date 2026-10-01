import { describe, expect, it } from 'vitest';
import {
  parseKitaLulusSearchPage,
  parseKitaLulusDetailPage,
} from '../../../../src/scraping/providers/kitalulus/kitalulus.parser.js';

describe('KitaLulus Parser', () => {
  const sampleSearchHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="job-list-container">
          <!-- Job card 1 -->
          <article class="job-card" data-testid="job-card">
            <a href="/id/lowongan/admin-operasional-12345" class="job-title-link">
              <h3 class="job-title">Staff Admin Operasional</h3>
            </a>
            <div class="company-name">PT Sukses Makmur Abadi</div>
            <div class="job-location">Jakarta Selatan, DKI Jakarta</div>
            <div class="job-salary">Rp 5.000.000 - Rp 6.500.000 / Bulan</div>
            <div class="job-work-mode">WFO</div>
            <span class="job-posted-time">2 hari yang lalu</span>
          </article>

          <!-- Job card 2 with minimal fields -->
          <article class="job-card" data-testid="job-card">
            <a href="https://kerja.kitalulus.com/id/lowongan/frontend-dev-67890">
              <h3 class="job-title">Frontend Developer</h3>
            </a>
            <div class="company-name">Tech Solusi Digital</div>
            <div class="job-location">Remote</div>
            <div class="job-work-mode">WFH</div>
            <span class="job-posted-time">3 jam yang lalu</span>
          </article>
        </div>
      </body>
    </html>
  `;

  const sampleDetailHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="job-detail-content">
          <div class="job-description">
            <p>Kami mencari Staff Admin Operasional yang teliti dan berpengalaman.</p>
            <h4>Tanggung Jawab:</h4>
            <ul>
              <li>Mengelola dokumen operasional harian</li>
              <li>Rekapitulasi data transaksi harian</li>
            </ul>
          </div>
          <div class="job-requirements">
            <h4>Kualifikasi:</h4>
            <ul>
              <li>Pendidikan minimal D3/S1 semua jurusan</li>
              <li>Menguasai Microsoft Excel dan Google Sheets</li>
            </ul>
          </div>
          <div class="job-tags">
            <span class="skill-tag">Microsoft Excel</span>
            <span class="skill-tag">Administrasi</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it('extracts job cards from search page HTML with relative date parsing', () => {
    const jobs = parseKitaLulusSearchPage(sampleSearchHtml, 'https://kerja.kitalulus.com');
    expect(jobs.length).toBe(2);

    const first = jobs[0];
    expect(first.title).toBe('Staff Admin Operasional');
    expect(first.company).toBe('PT Sukses Makmur Abadi');
    expect(first.location).toBe('Jakarta Selatan, DKI Jakarta');
    expect(first.source).toBe('kitalulus');
    expect(first.workMode).toBe('onsite');
    expect(first.salaryMin).toBe(5000000);
    expect(first.salaryMax).toBe(6500000);
    expect(first.salaryCurrency).toBe('IDR');
    expect(first.jobUrl).toBe('https://kerja.kitalulus.com/id/lowongan/admin-operasional-12345');
    expect(first.externalId).toBe('admin-operasional-12345');
    expect(first.publishedAt).toBeDefined();

    const second = jobs[1];
    expect(second.title).toBe('Frontend Developer');
    expect(second.company).toBe('Tech Solusi Digital');
    expect(second.workMode).toBe('remote');
    expect(second.jobUrl).toBe('https://kerja.kitalulus.com/id/lowongan/frontend-dev-67890');
    expect(second.externalId).toBe('frontend-dev-67890');
  });

  it('extracts detail description and requirements from detail page HTML', () => {
    const detail = parseKitaLulusDetailPage(sampleDetailHtml);
    expect(detail).toBeDefined();
    expect(detail.description).toContain('Kami mencari Staff Admin Operasional');
    expect(detail.description).toContain('Mengelola dokumen operasional harian');
    expect(detail.skills).toContain('Microsoft Excel');
    expect(detail.skills).toContain('Administrasi');
  });

  it('extracts jobs from Next.js __NEXT_DATA__ if present in search page', () => {
    const nextDataHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "initialState": {
                    "vacancies": [
                      {
                        "id": "vac-1",
                        "slug": "data-analyst-vac-1",
                        "title": "Data Analyst",
                        "company_name": "PT Data Analytics Indonesia",
                        "city": "Jakarta",
                        "salary_min": 7000000,
                        "salary_max": 9000000,
                        "work_arrangement": "Hybrid",
                        "employment_type": "Full Time",
                        "created_at": "2026-09-25T08:00:00.000Z"
                      }
                    ]
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    const jobs = parseKitaLulusSearchPage(nextDataHtml, 'https://kerja.kitalulus.com');
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Data Analyst');
    expect(jobs[0].company).toBe('PT Data Analytics Indonesia');
    expect(jobs[0].workMode).toBe('hybrid');
    expect(jobs[0].employmentType).toBe('full-time');
    expect(jobs[0].salaryMin).toBe(7000000);
    expect(jobs[0].salaryMax).toBe(9000000);
  });

  it('extracts jobs from modern Next.js anchor card markup', () => {
    const modernHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="flex flex-col gap-4">
            <a class="hover:no-underline" href="/lowongan/detail/staff-admin-faktur-pqnn">
              <div>
                <h3 class="truncate" title="Staff Admin Faktur">Staff Admin Faktur</h3>
                <p class="truncate" title="PT Kekal Abadi Packindo">PT Kekal Abadi Packindo</p>
                <p class="text-neutral-800 text-xs">Jakarta Barat, DKI Jakarta</p>
                <p class="text-neutral-800 text-xs">Rp 4.500.000 - Rp 5.500.000</p>
                <p class="text-neutral-500 text-xs">Terakhir diperbarui hari ini</p>
              </div>
            </a>
          </div>
        </body>
      </html>
    `;

    const jobs = parseKitaLulusSearchPage(modernHtml, 'https://kerja.kitalulus.com');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Staff Admin Faktur');
    expect(jobs[0].company).toBe('PT Kekal Abadi Packindo');
    expect(jobs[0].location).toBe('Jakarta Barat, DKI Jakarta');
    expect(jobs[0].externalId).toBe('staff-admin-faktur-pqnn');
    expect(jobs[0].jobUrl).toBe('https://kerja.kitalulus.com/lowongan/detail/staff-admin-faktur-pqnn');
    expect(jobs[0].salaryMin).toBe(4500000);
    expect(jobs[0].salaryMax).toBe(5500000);
  });

  it('handles empty or malformed HTML gracefully without throwing', () => {
    expect(parseKitaLulusSearchPage('', 'https://kerja.kitalulus.com')).toEqual([]);
    expect(parseKitaLulusDetailPage('')).toEqual({ description: '' });
  });
});

