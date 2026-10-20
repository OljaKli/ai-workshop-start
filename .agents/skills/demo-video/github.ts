// GitHub, prepared in advance for the demo: the real JetBrains repositories of tests/snapshots, at
// their fixed commits, and a JetBrains organization that lists them. Offline and the same on every
// run, so a recording never depends on the network or the rate limit.
import { readFileSync } from 'node:fs';
import { replay, type Recording } from '../../../src/core/replay.ts';

const snapshots = new URL('../../../tests/snapshots/', import.meta.url);

/** The organization's repositories: the snapshot file and GitHub's description. */
const repositories = [
  { file: 'android.txt', description: 'Android Studio and the Android plugin for IntelliJ IDEA' },
  { file: 'koog.txt', description: 'Koog, the Kotlin framework for AI agents' },
  { file: 'mps.txt', description: 'JetBrains Meta Programming System' },
];

/** One snapshot, `skill-atlas scan` output, read back as GitHub answers for its repository. */
function repository(file: string): Recording {
  const lines = readFileSync(new URL(file, snapshots), 'utf8').trimEnd().split('\n');
  const id = lines[0].split(' · ')[0];
  const recording: Recording = {};
  const paths: string[] = [];
  let commit = '';
  for (let i = 1; i < lines.length; i++) {
    const [name, description] = lines[i].split(' — ');
    const link = /^ {2}https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([0-9a-f]{40})\/(.+)$/.exec(lines[++i])!;
    commit = link[1];
    const copies = lines[i + 1]?.startsWith('  also in ') ? lines[++i].slice('  also in '.length).split(', ') : [];
    for (const path of [link[2], ...copies]) {
      paths.push(path);
      recording[`https://raw.githubusercontent.com/${id}/${commit}/${path}`] = {
        status: 200,
        body: `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n`,
      };
    }
  }
  recording[`https://api.github.com/repos/${id}`] = { status: 200, body: { full_name: id, default_branch: 'main' } };
  recording[`https://api.github.com/repos/${id}/commits/main`] = { status: 200, body: { sha: commit } };
  for (let page = 1; (page - 1) * 100 < Math.max(paths.length, 1); page++) {
    recording[`https://api.github.com/search/code?q=filename:SKILL.md+repo:${id}&per_page=100&page=${page}`] = {
      status: 200,
      body: { total_count: paths.length, items: paths.slice((page - 1) * 100, page * 100).map((path) => ({ path })) },
    };
  }
  return recording;
}

const recording: Recording = Object.assign({}, ...repositories.map(({ file }) => repository(file)), {
  'https://api.github.com/orgs/JetBrains': { status: 200, body: { login: 'JetBrains' } },
  'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': {
    status: 200,
    body: repositories.map(({ file, description }) => {
      const id = readFileSync(new URL(file, snapshots), 'utf8').split(' · ')[0];
      return { name: id.split('/')[1], full_name: id, description };
    }),
  },
});

/** GitHub as the demo sees it; serve it with a token, so scans go through code search. */
export const github = replay(recording);
