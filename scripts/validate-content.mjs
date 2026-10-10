import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const publicDirectory = path.resolve('public');
const catalogue = JSON.parse(await readFile(path.join(publicDirectory, 'works/catalogue.json'), 'utf8'));
const projectTags = JSON.parse(await readFile(path.resolve('src/content/project-tags.json'), 'utf8'));
const slugs = new Set();
const types = ['bedrock', 'java', 'tools', 'mods'];
const tabs = ['description', 'changelog', 'versions'];
const localeKeys = ['zh', 'en', 'ja'];

function textValues(value, label) {
  if (typeof value === 'string' && value.trim()) return [value];
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} needs text or localized text.`);
  const entries = Object.entries(value);
  assert(entries.length > 0, `${label} cannot be empty.`);
  for (const [locale, text] of entries) {
    assert(localeKeys.includes(locale) && typeof text === 'string' && text.trim(), `${label}.${locale} is invalid.`);
  }
  return entries.map(([, text]) => text);
}

async function checkAsset(value, label, markdown = false) {
  assert(typeof value === 'string' && value.trim(), `${label} needs an asset path.`);
  if (/^https?:\/\//.test(value)) return;
  const target = path.resolve(publicDirectory, value.replace(/^\/+/, ''));
  assert(target.startsWith(`${publicDirectory}${path.sep}`), `${label} must stay inside public/.`);
  if (markdown) assert(target.endsWith('.md'), `${label} must reference Markdown.`);
  await access(target).catch(() => { throw new Error(`${label}: missing file ${value}`); });
}

assert(catalogue.schemaVersion === 1 && Array.isArray(catalogue.projects), 'Catalogue schemaVersion must be 1 with a projects array.');
for (const [id, labels] of Object.entries(projectTags)) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `Invalid genre ID: ${id}`);
  for (const locale of localeKeys) assert(typeof labels[locale] === 'string' && labels[locale].trim(), `Genre ${id} needs a ${locale} label.`);
}
for (const project of catalogue.projects) {
  assert(typeof project.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug), 'Project slug must use lowercase letters, numbers and hyphens.');
  const label = project.slug;
  assert(!slugs.has(label), `Duplicate project slug: ${label}`);
  slugs.add(label);
  assert(types.includes(project.type), `${label}: unknown type.`);
  assert(['released', 'development', 'planned'].includes(project.status), `${label}: unknown status.`);
  textValues(project.title, `${label}.title`);
  if (project.summary) textValues(project.summary, `${label}.summary`);
  assert(Array.isArray(project.tags) && project.tags.length <= 4 && new Set(project.tags).size === project.tags.length && project.tags.every((tag) => Object.hasOwn(projectTags, tag)), `${label}: tags must contain up to four unique IDs from src/content/project-tags.json.`);
  assert(!project.translations?.tags, `${label}: genre tags must not point to descriptions or feature translations.`);
  assert(Array.isArray(project.platform) && project.platform.length > 0 && project.platform.every((item) => typeof item === 'string'), `${label}: platform must contain strings.`);
  assert(Array.isArray(project.creators) && project.creators.length > 0 && project.creators.every((creator) => typeof creator.name === 'string' && creator.name.trim()), `${label}: creator name is required.`);
  for (const field of ['published', 'updated']) {
    if (project[field]) assert(/^\d{4}-\d{2}-\d{2}$/.test(project[field]) && !Number.isNaN(Date.parse(project[field])), `${label}.${field}: use YYYY-MM-DD.`);
  }
  if (project.downloads !== undefined) assert(Number.isInteger(project.downloads) && project.downloads >= 0, `${label}: downloads must be a nonnegative integer.`);
  for (const field of ['store', 'repository', 'issues', 'releasePage']) {
    if (project[field]) assert(/^https:\/\//.test(project[field]), `${label}.${field}: use an HTTPS URL.`);
  }
  await checkAsset(project.image, `${label}.image`);
  for (const field of ['download', 'fallbackDownload']) if (project[field]) await checkAsset(project[field], `${label}.${field}`);
  assert(project.content && typeof project.content === 'object', `${label}: content is required.`);
  for (const tab of tabs) {
    for (const contentPath of textValues(project.content[tab], `${label}.content.${tab}`)) {
      await checkAsset(contentPath, `${label}.content.${tab}`, true);
    }
  }
}

console.log(`Validated ${catalogue.projects.length} projects, unique slugs, assets and all three Markdown tabs.`);
