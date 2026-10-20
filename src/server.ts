// The web client: one page where you paste a GitHub repository or organization URL, and the JSON
// API it calls. Like the CLI, a thin client over the core; nothing is stored. Local directories
// are not served.
import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { AtlasError } from './core/errors.ts';
import { listOrganization, openGitHub, parseGitHubOrganizationUrl, parseGitHubUrl, type Fetch, type Organization } from './core/github.ts';
import { skillLink, type Skill } from './core/model.ts';
import { scan, type Source } from './core/scan.ts';

export type WebOptions = {
  fetch: Fetch;
  /** Code search and a higher rate limit, as for the CLI. */
  token?: string;
};

/** What `GET /api/scan?url=<GitHub URL>` answers. */
export type ScanAnswer = {
  repository: { id: string; url: string; commit: string };
  skills: { id: string; name: string; description: string; path: string; link: string; copies: string[]; updated: string | null }[];
  warnings: string[];
};

/** What `GET /api/organization?url=<GitHub organization URL>` answers. */
export type OrganizationAnswer = Organization;

const page = new URL('./web/index.html', import.meta.url);

export function createWebServer(options: WebOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error: 'Method not allowed' });
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(await readFile(page));
    }
    if (url.pathname === '/api/scan') {
      const [status, body] = await scanAnswer(url.searchParams.get('url') ?? '', options);
      return send(response, status, body);
    }
    if (url.pathname === '/api/organization') {
      const [status, body] = await organizationAnswer(url.searchParams.get('url') ?? '', options);
      return send(response, status, body);
    }
    send(response, 404, { error: `Not found: ${url.pathname}` });
  });
}

/** 200 and the skills; 400 for input that is not a GitHub repository; 502 when GitHub cannot be scanned. */
async function scanAnswer(input: string, options: WebOptions): Promise<[number, ScanAnswer | { error: string }]> {
  if (!parseGitHubUrl(input)) return [400, { error: `Not a GitHub repository URL: ${input}` }];
  try {
    const source = await openGitHub(input, options);
    const { repository, skills, warnings } = await scan(source);
    const updated = await lastUpdated(source, skills, warnings);
    return [
      200,
      {
        repository: { id: repository.id, url: repository.url, commit: repository.commit },
        skills: skills.map((skill, index) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          path: skill.path,
          link: skillLink(repository, skill),
          copies: skill.copies,
          updated: updated[index],
        })),
        warnings,
      },
    ];
  } catch (error) {
    return failure(error);
  }
}

/** When each skill last changed, or null: unknown without a token; lookups GitHub cannot answer are one warning. */
async function lastUpdated(source: Source, skills: Skill[], warnings: string[]): Promise<(string | null)[]> {
  if (!source.updated) return skills.map(() => null);
  const results = await Promise.all(
    skills.map((skill) =>
      source.updated!(skill.path).then(
        (date) => ({ date: date ?? null }),
        (error: unknown) => ({ date: null, error: error instanceof Error ? error.message : String(error) }),
      ),
    ),
  );
  // In skill order, whichever lookup answered first: the same warning every time.
  const failures = results.flatMap((result) => ('error' in result ? [result.error] : []));
  if (failures.length > 0) {
    warnings.push(`cannot tell when ${failures.length} ${failures.length === 1 ? 'skill was' : 'skills were'} last updated: ${failures[0]}`);
  }
  return results.map((result) => result.date);
}

/** 200 and the repositories; 400 for input that is not a GitHub organization; 502 when GitHub cannot list it. */
async function organizationAnswer(input: string, options: WebOptions): Promise<[number, OrganizationAnswer | { error: string }]> {
  if (!parseGitHubOrganizationUrl(input)) return [400, { error: `Not a GitHub organization URL: ${input}` }];
  try {
    return [200, await listOrganization(input, options)];
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): [number, { error: string }] {
  if (error instanceof AtlasError) return [502, { error: error.message }];
  return [500, { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` }];
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
