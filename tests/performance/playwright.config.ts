import {defineConfig} from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({...base,testDir:".",workers:1,reporter:"list",
  webServer:[base.webServer].flat().filter(server=>server!==undefined).map(server=>({...server,cwd:process.cwd()})),
  projects:base.projects?.filter(project=>project.name==="chromium"),
});
