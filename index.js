/**
 * GARMIN Job Scraper - Main Entry Point
 * 
 * PURPOSE: Scrapes job listings from Garmin Careers (Workable) and stores them in Solr.
 * This is the primary orchestrator that coordinates company validation, job scraping,
 * data transformation, and Solr storage.
 */

import fetch from "node-fetch";
import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany } from "./company.js";
import { querySOLR, deleteJobByUrl, upsertJobs } from "./solr.js";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// GARMIN's unique identifier in Romanian business registry (CIF/CUI)
const COMPANY_CIF = "18850101";

// Request timeout in milliseconds (10 seconds)
const TIMEOUT = 10000;

// Base URL for Garmin job listings
const JOB_BASE = "https://apply.workable.com";

// Garmin Workable subdomain
const WORKABLE_SUBDOMAIN = "garmin-cluj";

// Global variable to store company name after validation
let COMPANY_NAME = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promise-based sleep function to introduce delays between requests
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// API FUNCTIONS - Fetching data from Garmin Careers (Workable)
// ============================================================================

/**
 * Fetches jobs from Workable API
 * @returns {Promise<Object>} - API response with job data
 */
async function fetchJobsFromWorkable() {
  const url = `https://apply.workable.com/api/v1/accounts/${WORKABLE_SUBDOMAIN}/jobs`;
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });
  
  if (!res.ok) {
    throw new Error(`Workable API error ${res.status}`);
  }
  
  const data = await res.json();
  return data;
}

// ============================================================================
// DATA PARSING - Converting API response to our job model
// ============================================================================

/**
 * Parses raw API response into our standardized job format
 * @param {Object} apiData - Raw response from Workable API
 * @returns {Object} - Object containing jobs array
 */
function parseWorkableJobs(apiData) {
  const jobs = apiData.jobs || [];
  
  return {
    jobs: jobs.map(job => {
      // Determine work mode - Garmin Cluj appears to be on-site
      let workmode = "on-site";
      if (job.workplace_type?.toLowerCase().includes("remote")) workmode = "remote";
      else if (job.workplace_type?.toLowerCase().includes("hybrid")) workmode = "hybrid";
      
      // Extract location - Garmin jobs are primarily in Cluj-Napoca
      const location = [];
      if (job.location?.city) {
        location.push(job.location.city);
      } else if (job.location?.country) {
        location.push(job.location.country);
      }
      
      // Build job URL
      const url = job.url || `${JOB_BASE}/${WORKABLE_SUBDOMAIN}/j/${job.shortcode}`;
      
      // Extract tags/skills from job description or title
      const tags = [];
      if (job.title) {
        // Extract common tech tags from title
        const techKeywords = ["Java", "Python", "C++", "JavaScript", "React", "iOS", "Android", ".NET", "Data", "Cloud", "DevOps", "SRE", "Embedded", "Engineer"];
        const titleLower = job.title.toLowerCase();
        for (const keyword of techKeywords) {
          if (titleLower.includes(keyword.toLowerCase())) {
            tags.push(keyword.toLowerCase());
          }
        }
      }
      
      // Return standardized job object
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

// ============================================================================
// SCRAPING LOGIC - Collect all jobs
// ============================================================================

/**
 * Scrapes all job listings from Garmin Careers (Workable)
 * @param {boolean} testOnlyOnePage - If true, stops after first fetch (for testing)
 * @returns {Promise<Array>} - Array of unique job objects
 */
async function scrapeAllListings(testOnlyOnePage = false) {
  const allJobs = [];
  const seenUrls = new Set();
  
  try {
    console.log("Fetching jobs from Workable API...");
    const data = await fetchJobsFromWorkable();
    const result = parseWorkableJobs(data);
    const jobs = result.jobs;
    
    console.log(`Found ${jobs.length} jobs from Workable API`);
    
    // Collect unique jobs
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

// ============================================================================
// DATA TRANSFORMATION - Preparing jobs for Solr storage
// ============================================================================

/**
 * Maps raw job data to Solr-compatible job model
 * @param {Object} rawJob - Job object from scraper
 * @param {string} cif - Company identifier
 * @param {string} companyName - Company name
 * @returns {Object} - Job object ready for Solr storage
 */
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

/**
 * Transforms jobs to match Solr schema
 * @param {Object} payload - Job payload with jobs array
 * @returns {Object} - Transformed payload ready for Solr
 */
function transformJobsForSOLR(payload) {
  const romanianCities = [
    'Cluj-Napoca', 'Cluj Napoca', 'Timișoara', 'Timisoara', 'Iași', 'Iasi',
    'Brașov', 'Brasov', 'Constanța', 'Constanta', 'București', 'Bucharest',
    'Sibiu', 'Oradea', 'Baia Mare', 'Satu Mare', 'Ploiești', 'Ploiesti',
    'Pitești', 'Pitesti', 'Arad', 'Galați', 'Galati', 'Braila', 'Buzau'
  ];

  const citySet = new Set(romanianCities.map(c => c.toLowerCase()));

  const normalizeWorkmode = (wm) => {
    if (!wm) return undefined;
    const lower = wm.toLowerCase();
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('office') || lower.includes('on-site') || lower.includes('site')) return 'on-site';
    return 'hybrid';
  };

  const transformed = {
    ...payload,
    company: payload.company?.toUpperCase(),
    jobs: payload.jobs.map(job => {
      const validLocations = (job.location || []).filter(loc => {
        const lower = loc.toLowerCase().trim();
        if (lower === 'romania' || lower === 'românia') return true;
        return citySet.has(lower);
      }).map(loc => loc.toLowerCase() === 'romania' ? 'România' : loc);

      return {
        ...job,
        location: validLocations.length > 0 ? validLocations : ['Cluj-Napoca'],
        workmode: normalizeWorkmode(job.workmode)
      };
    })
  };

  return transformed;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

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
