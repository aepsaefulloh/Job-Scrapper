import { describe, expect, it } from 'vitest';
import {
  parseKarirSearchPage,
  parseKarirDetailPage,
  parseKarirApiOpportunity,
  parseKarirApiDetail,
} from '../../../../src/scraping/providers/karir/karir.parser.js';

describe('Karir.com Parser', () => {
  const sampleSearchHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="search-results">
          <!-- Opportunity card 1 -->
          <article class="opportunity-card">
            <a href="/opportunities/10101-accounting-officer" class="opportunity-title">
              <h3 class="title">Accounting Officer</h3>
            </a>
            <div class="company-name">
              <a href="/companies/pt-keuangan-sejahtera">PT Keuangan Sejahtera</a>
            </div>
            <div class="location">Jakarta Pusat</div>
            <div class="salary-range">IDR 6.000.000 - 8.500.000</div>
            <span class="posting-date">Tayang 3 hari yang lalu</span>
          </article>

          <!-- Opportunity card 2 -->
          <article class="opportunity-card">
            <a href="https://karir.com/opportunities/20202-marketing-specialist">
              <h3 class="title">Digital Marketing Specialist</h3>
            </a>
            <div class="company-name">PT Media Kreasi Baru</div>
            <div class="location">Surabaya</div>
            <span class="posting-date">Kemarin</span>
          </article>
        </div>
      </body>
    </html>
  `;

  const sampleDetailHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="opportunity-detail">
          <div class="opportunity-description">
            <p>PT Keuangan Sejahtera membuka lowongan untuk Accounting Officer.</p>
            <p>Deskripsi Pekerjaan:</p>
            <ul>
              <li>Menyusun laporan keuangan bulanan dan tahunan</li>
              <li>Rekonsiliasi bank dan pengelolaan kas kecil</li>
            </ul>
          </div>
          <div class="opportunity-requirements">
            <p>Persyaratan:</p>
            <ul>
              <li>S1 Akuntansi dari universitas terkemuka</li>
              <li>Pengalaman minimal 2 tahun di bidang akuntansi/keuangan</li>
            </ul>
          </div>
          <div class="skills-list">
            <span class="tag-skill">Akuntansi</span>
            <span class="tag-skill">Pajak</span>
            <span class="tag-skill">Excel</span>
          </div>
        </div>
      </body>
    </html>
  `;

  it('extracts opportunities from search page HTML with relative date parsing', () => {
    const jobs = parseKarirSearchPage(sampleSearchHtml, 'https://karir.com');
    expect(jobs.length).toBe(2);

    const first = jobs[0];
    expect(first.title).toBe('Accounting Officer');
    expect(first.company).toBe('PT Keuangan Sejahtera');
    expect(first.location).toBe('Jakarta Pusat');
    expect(first.source).toBe('karir');
    expect(first.salaryMin).toBe(6000000);
    expect(first.salaryMax).toBe(8500000);
    expect(first.salaryCurrency).toBe('IDR');
    expect(first.jobUrl).toBe('https://karir.com/opportunities/10101-accounting-officer');
    expect(first.externalId).toBe('10101');
    expect(first.publishedAt).toBeDefined();

    const second = jobs[1];
    expect(second.title).toBe('Digital Marketing Specialist');
    expect(second.company).toBe('PT Media Kreasi Baru');
    expect(second.location).toBe('Surabaya');
    expect(second.jobUrl).toBe('https://karir.com/opportunities/20202-marketing-specialist');
    expect(second.externalId).toBe('20202');
  });

  it('extracts detail description and skills from detail page HTML', () => {
    const detail = parseKarirDetailPage(sampleDetailHtml);
    expect(detail).toBeDefined();
    expect(detail.description).toContain('PT Keuangan Sejahtera membuka lowongan');
    expect(detail.description).toContain('Menyusun laporan keuangan');
    expect(detail.skills).toContain('Akuntansi');
    expect(detail.skills).toContain('Pajak');
    expect(detail.skills).toContain('Excel');
  });

  it('extracts opportunities from embedded JSON payload if present', () => {
    const jsonStateHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "opportunities": [
                    {
                      "id": 30303,
                      "title": "HR Generalist",
                      "company": { "name": "PT Sumber Daya Utama" },
                      "location": { "name": "Tangerang" },
                      "salary_min": 6000000,
                      "salary_max": 8000000,
                      "currency": "IDR",
                      "created_at": "2026-09-25T00:00:00.000Z",
                      "slug": "30303-hr-generalist"
                    }
                  ]
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    const jobs = parseKarirSearchPage(jsonStateHtml, 'https://karir.com');
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('HR Generalist');
    expect(jobs[0].company).toBe('PT Sumber Daya Utama');
    expect(jobs[0].location).toBe('Tangerang');
    expect(jobs[0].salaryMin).toBe(6000000);
    expect(jobs[0].jobUrl).toBe('https://karir.com/opportunities/30303-hr-generalist');
  });

  it('handles empty or malformed HTML gracefully without throwing', () => {
    expect(parseKarirSearchPage('', 'https://karir.com')).toEqual([]);
    expect(parseKarirDetailPage('')).toEqual({ description: '' });
  });

  it('parses Karir gateway API search opportunity and detail responses correctly', () => {
    const rawOpp = {
      id: 1401567,
      job_position: 'Administrasi Building Management',
      company_name: 'PT Pesonna Indonesia Jaya',
      description: 'Prov. DKI-Jakarta • Kontrak • On-Site',
      salary_lower: 5000000,
      salary_upper: 7000000,
      posted_at: '2026-10-01T07:15:00Z',
    };

    const parsed = parseKarirApiOpportunity(rawOpp, 'https://karir.com');
    expect(parsed.title).toBe('Administrasi Building Management');
    expect(parsed.company).toBe('PT Pesonna Indonesia Jaya');
    expect(parsed.location).toBe('Prov. DKI-Jakarta • Kontrak • On-Site');
    expect(parsed.jobUrl).toBe('https://karir.com/opportunities/1401567');
    expect(parsed.externalId).toBe('1401567');
    expect(parsed.salaryMin).toBe(5000000);
    expect(parsed.salaryMax).toBe(7000000);
    expect(parsed.salaryCurrency).toBe('IDR');
    expect(parsed.publishedAt).toBe('2026-10-01T07:15:00.000Z');

    const rawDetail = {
      id: 1401567,
      job_position: 'Administrasi Building Management',
      responsibilities: '<p>Tanggung Jawab:</p><ul><li>Membuat laporan berkala</li></ul>',
      requirements: '<p>Kualifikasi:</p><ul><li>Minimal S1 Administrasi</li></ul>',
      required_skills: [{ name: 'Microsoft Office' }, { name: 'Filling Dokumen' }],
    };

    const detail = parseKarirApiDetail(rawDetail);
    expect(detail.description).toContain('Membuat laporan berkala');
    expect(detail.description).toContain('Minimal S1 Administrasi');
    expect(detail.skills).toEqual(['Microsoft Office', 'Filling Dokumen']);
  });
});

