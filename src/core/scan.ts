import { findSkills, type SkillFile } from './find.ts';
import { sortSkills, type Repository, type Skill } from './model.ts';
import { parseSkill } from './parse.ts';

/** A repository to scan: its files, and how to read them. */
export type Source = {
  repository: Repository;
  /** Every file path, relative to the repository root. */
  paths: string[];
  /** What listing the files had to leave out. */
  warnings: string[];
  /** The file's bytes, or undefined if it is not there. */
  read(path: string): Promise<Uint8Array | undefined>;
  /** When the file last changed, `YYYY-MM-DD` in UTC, or undefined; only where the source can tell. */
  updated?(path: string): Promise<string | undefined>;
};

export type ScanOptions = {
  /** Also looks up when each skill last changed, if the source can tell. */
  updated?: boolean;
};

export type ScanResult = { repository: Repository; skills: Skill[]; warnings: string[] };

/** fetch → find → parse. Nothing is stored: the result is all there is. */
export async function scan(source: Source, options: ScanOptions = {}): Promise<ScanResult> {
  const files = findSkills(source.paths, source.repository.name);
  const updated = options.updated ? source.updated?.bind(source) : undefined;
  // The files are read at the same time: on GitHub, each one is a request.
  const results = await Promise.all(files.map((file) => readSkill(source, file, updated)));
  const skills = sortSkills(results.flatMap((result) => (result.skill ? [result.skill] : [])));
  const unknown = updated ? skills.filter((skill) => !skill.updated).length : 0;
  return {
    repository: source.repository,
    skills,
    warnings: [
      ...source.warnings,
      ...results.flatMap((result) => (result.warning ? [result.warning] : [])),
      ...(unknown > 0 ? [`GitHub could not tell when ${unknown} ${unknown === 1 ? 'skill' : 'skills'} last changed; shown without a date`] : []),
    ],
  };
}

async function readSkill(
  source: Source,
  file: SkillFile,
  updated?: (path: string) => Promise<string | undefined>,
): Promise<{ skill?: Skill; warning?: string }> {
  // A date GitHub cannot give is a missing date, never a failed scan.
  const [bytes, date] = await Promise.all([source.read(file.path), updated?.(file.path).catch(() => undefined)]);
  if (!bytes) return { warning: `${file.path}: listed, but not found at the scanned commit; skipped` };
  const parsed = parseSkill(new TextDecoder().decode(bytes));
  const skill: Skill = {
    id: `${source.repository.id}:${file.path}`,
    repository: source.repository.id,
    path: file.path,
    name: parsed.name ?? file.name,
    description: parsed.description,
    commit: source.repository.commit,
    copies: file.copies,
    ...(date && { updated: date }),
  };
  return { skill, warning: parsed.warning && `${file.path}: ${parsed.warning}` };
}
