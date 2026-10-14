import catalogueSchema from '../../public/works/catalogue.schema.json';
import { MAX_FILE_SIZE } from './model';

const text = { type: 'string', maxLength: 200_000 };
const localized = { anyOf: [text, { type: 'object', properties: { zh: text, en: text, ja: text }, minProperties: 1, additionalProperties: false }] };
const id = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$' };
const asset = { type: 'object', additionalProperties: false, required: ['id', 'name', 'size', 'mime', 'sha256'], properties: {
  id, name: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$' }, displayName: {type:'string',minLength:1,maxLength:200,pattern:'^[^\u0000-\u001f\u007f]+$'},
  size: { type: 'integer', minimum: 1, maximum: MAX_FILE_SIZE }, mime: { type: 'string' },
  sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, privateKey: { type: 'string', pattern: '^uploads/verified/[a-zA-Z0-9-]+/[a-zA-Z0-9._-]+$' },
  publicUrl: { type: 'string', format: 'uri' }, primary: { type: 'boolean' },
} };
const project = structuredClone(catalogueSchema.$defs.project);
// Embed the existing contract without losing fields or accepting unknown ones.
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'works'], properties: { schemaVersion: { const: 1 }, works: {
    type: 'array', maxItems: 500, items: { type: 'object', additionalProperties: false,
      required: ['id', 'project', 'workflow', 'order', 'markdown', 'gallery', 'versions', 'createdAt', 'updatedAt'],
      properties: { id, project, legacy: project, workflow: { enum: ['draft', 'ready', 'archived'] },
        order: { type: 'integer', minimum: 0, maximum: 100000 }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }, coverId: id,
        markdown: { type: 'object', required: ['description', 'changelog', 'versions'], additionalProperties: false,
          properties: Object.fromEntries(['description', 'changelog', 'versions'].map(k => [k, { type: 'object', additionalProperties: false, maxProperties: 3, properties: { zh: text, en: text, ja: text } }])) },
        gallery: { type: 'array', maxItems: 100, items: asset }, versions: { type: 'array', maxItems: 100, items: {
          type: 'object', additionalProperties: false, required: ['id', 'label', 'date', 'gameVersions', 'status', 'changelog', 'files'],
          properties: { id, label: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,79}$' }, date: { type: 'string', format: 'date' },
            gameVersions: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 80 } }, status: { enum: ['draft', 'released'] },
            changelog: localized, files: { type: 'array', maxItems: 30, items: asset },
          },
        } },
      },
    },
  } }, $defs: catalogueSchema.$defs,
};
export const librarySchema = schema;
