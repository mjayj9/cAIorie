import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/browser",timeout:45000,fullyParallel:false,workers:1,retries:0,
 reporter:[["list"],["json",{outputFile:"test-results/browser-results.json"}]],
 use:{baseURL:process.env.TEST_BASE_URL??"http://localhost:5173",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1040}}}],
});
