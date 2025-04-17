// lib/app-config.ts
import pkg from "../../../package.json";

export const appConfig = {
  name: "Social Saver",
  description: "Universal Desktop Media Downloader",
  author: "Vishal Kaleria",
  authorTagline: "Full-stack Software Developer",
  version: pkg.version,

  website: "https://socialsaver.site",
  apiBase: "https://social-saver-web.pages.dev",
  githubRepo: "https://github.com/vishalkaleria/social-saver",

  links: {
    website: "https://socialsaver.site",
    documentation: "https://socialsaver.site/docs",
    help: "https://socialsaver.site/docs/troubleshooting",
    donate: "/donate",
    reportIssue: "https://github.com/vishalkaleria/social-saver/issues/new?template=bug_report.md",
    requestFeature: "https://github.com/vishalkaleria/social-saver/issues/new?template=feature_request.md",
    privacy: "https://socialsaver.site/privacy",
    terms: "https://socialsaver.site/terms",
    roadmap: "https://github.com/vishalkaleria/social-saver/projects/1",
  },

  social: {
    github: "https://github.com/vishalkaleria",
    twitter: "https://twitter.com/vishalkaleria",
    linkedin: "https://linkedin.com/in/vishalkaleria",
    discord: "https://discord.gg/socialsaver",
  },

  donation: {
    buyMeACoffee: "https://www.buymeacoffee.com/vishalkaleria",
    githubSponsor: "https://github.com/sponsors/vishalkaleria",
  },
};
