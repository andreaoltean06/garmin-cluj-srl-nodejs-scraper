/**
 * Extract jobs using Puppeteer for JavaScript-rendered content
 */
async function scrapeJobsFromPage() {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Opening Garmin careers page with Puppeteer...");
  await page.goto("https://apply.workable.com/garmin-cluj/?lng=en", { waitUntil: "networkidle0" });
  
  // Wait for jobs to load
  await page.waitForSelector(".job-card, [data-ui='job-card'], .job-item", { timeout: 10000 }).catch(() => {
    console.log("No job cards found with primary selector, trying alternative...");
  });
  
  // Extract job data
  const jobs = await page.evaluate(() => {
    const jobElements = document.querySelectorAll(".job-card, [data-ui='job-card'], .job-item, a[href*='/j/']");
    const jobsData = [];
    
    jobElements.forEach(elem => {
      const link = elem.href || elem.querySelector("a")?.href;
      const title = elem.querySelector("h3, .title, .job-title")?.innerText?.trim();
      const location = elem.querySelector(".location, .job-location")?.innerText?.trim();
      
      if (link && link.includes("/j/")) {
        jobsData.push({
          url: link,
          title: title || "Job at Garmin Cluj",
          location: location ? [location] : ["Cluj-Napoca"],
          shortcode: link.split("/").pop()
        });
      }
    });
    
    return jobsData;
  });
  
  await browser.close();
  
  console.log(`Puppeteer extracted ${jobs.length} jobs`);
  return { jobs, total: jobs.length };
}
  });
  
  if (!res.ok) {
    console.log(`Workable API error ${res.status}, trying alternative approach...`);
    return await scrapeJobsFromPage();
  }
  
  const data = await res.json();
  return data;
}

async function scrapeJobsFromPage() {
  const url = "https://apply.workable.com/garmin-cluj/jobs/";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch Garmin careers page: ${res.status}`);
  }
  
  const html = await res.text();
  const jobs = [];
  const jobPattern = /href="(https:\/\/apply\.workable\.com\/garmin-cluj\/j\/[^"]+)"/g;
  let match;
  
  while ((match = jobPattern.exec(html)) !== null) {
    jobs.push({
      url: match[1],
      title: "Job at Garmin Cluj",
      shortcode: match[1].split("/").pop()
    });
  }
  
  return { jobs, total: jobs.length };
}

function parseWorkableJobs(apiData) {
  const jobs = apiData.jobs || [];
  
  return {
    jobs: jobs.map(job => {
      let workmode = "on-site";
      if (job.workplace_type?.toLowerCase().includes("remote")) workmode = "remote";
      else if (job.workplace_type?.toLowerCase().includes("hybrid")) workmode = "hybrid";
      
      const location = [];
      if (job.location?.city) {
        location.push(job.location.city);
      } else if (job.location?.country) {
        location.push(job.location.country);
      }
      
      const url = job.url || `${JOB_BASE}/${WORKABLE_SUBDOMAIN}/j/${job.shortcode}`;
      
      const tags = [];
      if (job.title) {
        const techKeywords = ["Java", "Python", "C++", "JavaScript", "React", "iOS", "Android", ".NET", "Data", "Cloud", "DevOps", "SRE", "Embedded", "Engineer"];
        const titleLower = job.title.toLowerCase();
        for (const keyword of techKeywords) {
          if (titleLower.includes(keyword.toLowerCase())) {
            tags.push(keyword.toLowerCase());
          }
        }
      }
      
      return {
        url,
        title: job.title,
        uid: job.shortcode || job.id?.toString(),
        workmode,
        location,
        tags
      };
    }),
    total: jobs.length
  };
}

async function scrapeAllListings(testOnlyOnePage = false) {
  const allJobs = [];
  const seenUrls = new Set();
  
  try {
    console.log("Fetching jobs from Workable API...");
    const data = await fetchJobsFromWorkable();
    const result = parseWorkableJobs(data);
    const jobs = result.jobs;
    
    console.log(`Found ${jobs.length} jobs from Workable API`);
    
    let newJobs = 0;
    for (const job of jobs) {
      if (!seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        allJobs.push(job);
        newJobs++;
      }
    }
    
    console.log(`Total unique jobs: ${allJobs.length}`);
    
  } catch (err) {
    console.error("Error fetching from Workable:", err.message);
    throw err;
  }
  
  return allJobs;
}

function mapToJobModel(rawJob, cif, companyName = COMPANY_NAME) {
  const now = new Date().toISOString();

  const job = {
    url: rawJob.url,
    title: rawJob.title,
    company: companyName,
    cif: cif,
    location: rawJob.location?.length ? rawJob.location : undefined,
    tags: rawJob.tags?.length ? rawJob.tags : undefined,
    workmode: rawJob.workmode || undefined,
    date: now,
    status: "scraped"
  };

  Object.keys(job).forEach((k) => job[k] === undefined && delete job[k]);

  return job;
}

function transformJobsForSOLR(payload) {
  const romanianCities = [
    "Cluj-Napoca", "Cluj Napoca", "Timișoara", "Timisoara", "Iași", "Iasi",
    "Brașov", "Brasov", "Constanța", "Constanta", "București", "Bucharest",
    "Sibiu", "Oradea", "Baia Mare", "Satu Mare", "Ploiești", "Ploiesti",
    "Pitești", "Pitesti", "Arad", "Galați", "Galati", "Braila", "Buzau"
  ];

  const citySet = new Set(romanianCities.map(c => c.toLowerCase()));

  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes("remote")) return "remote";
    if (lower.includes("office") || lower.includes("on-site") || lower.includes("site")) return "on-site";
    return "hybrid";
  };

  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      const validLocations = (job.location || []).filter(loc => {
        const lower = loc.toLowerCase().trim();
        if (lower === "romania" || lower === "românia") return true;
        return citySet.has(lower);
      }).map(loc => loc.toLowerCase() === "romania" ? "România" : loc);

      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ["Cluj-Napoca"],
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

async function main() {
  const testOnlyOnePage = process.argv.includes("--test");
  
  try {
    console.log("=== Step 1: Get existing jobs count ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    console.log(`Found ${existingCount} existing jobs in SOLR`);

    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;
    
    const rawJobs = await scrapeAllListings(testOnlyOnePage);
    const scrapedCount = rawJobs.length;
    console.log(`Jobs scraped from Garmin Careers: ${scrapedCount}`);

    const jobs = rawJobs.map(job => mapToJobModel(job, localCif));

    const payload = {
      source: "garmin.com",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    console.log("Transforming jobs for SOLR...");
    const transformedPayload = transformJobsForSOLR(payload);
    const validCount = transformedPayload.jobs.filter(j => j.location).length;
    console.log(`Jobs with valid Romanian locations: ${validCount}`);

    fs.writeFileSync("jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved jobs.json");

    console.log("=== Step 4: Upsert jobs to SOLR ===");
    await upsertJobs(transformedPayload.jobs);

    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`\n=== SUMMARY ===`);
    console.log(`Jobs existing in SOLR before scrape: ${existingCount}`);
    console.log(`Jobs scraped from Garmin: ${scrapedCount}`);
    console.log(`Jobs in SOLR after scrape: ${finalResult.numFound}`);
    console.log(`====================`);

    console.log("\n=== DONE ===");
    console.log("Scraper completed successfully!");

  } catch (err) {
    console.error("Scraper failed:", err);
    process.exit(1);
  }
}

export { parseWorkableJobs, mapToJobModel, transformJobsForSOLR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

