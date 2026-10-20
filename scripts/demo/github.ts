// The GitHub the demo video scans: an organization, JetBrains, with repositories whose skills are
// taken from the checked-in snapshots, answered from a recording so every take looks the same.
import type { Fetch } from '../../src/core/github.ts';
import { replay, type Recording } from '../../src/core/replay.ts';

type Skill = { path: string; name: string; description: string };
type Repository = { name: string; description: string; commit: string; skills: Skill[] };

const agents = (name: string, description: string) => [
  { path: `.agents/skills/${name}/SKILL.md`, name, description },
  { path: `.claude/skills/${name}/SKILL.md`, name, description },
];

const repositories: Repository[] = [
  {
    name: 'android',
    description: 'Android Studio plugins for IntelliJ IDEA',
    commit: '6c1bcc42a2cbb45c241fafea9fbd82d32ac4d765',
    skills: [
      { path: 'agent/skills/android-studio-development/SKILL.md', name: 'android-studio-development', description: 'Specialist in Android Studio plugin development.' },
      { path: 'agent/skills/writing-lint-checks/SKILL.md', name: 'writing-lint-checks', description: 'Write and test Android Lint checks.' },
    ],
  },
  {
    name: 'koog',
    description: 'Koog, the Kotlin framework for AI agents',
    commit: '22e342e033c716f835312dd6cbe83193e1cbcf76',
    skills: [
      {
        path: '.claude/skills/add-java-code-snippets-in-docs/SKILL.md',
        name: 'add-java-code-snippets-in-docs',
        description: 'Use when the user asks to add Java tabs/examples to mkdocs docs that already have Kotlin examples.',
      },
      {
        path: '.claude/skills/split-jvm-nonjvm/SKILL.md',
        name: 'split-jvm-nonjvm',
        description: 'Splits a class or several classes in the common source set commonMain into JVM and non-JVM parts.',
      },
    ],
  },
  {
    name: 'MPS',
    description: 'JetBrains Meta Programming System',
    commit: 'd7e4f5c1394535b05e90dde6e3e7e8a3f3e174a2',
    skills: [
      ...agents('actions', 'Guidelines for implementing IntelliJ actions (AnAction).'),
      ...agents('code-style', 'Code style rules for IntelliJ codebase.'),
      ...agents('commits', 'Use this skill whenever the user asks to commit changes, write or fix a commit message, amend or rename a commit.'),
      ...agents('debugging', 'Debugging techniques and tools for IntelliJ development.'),
      ...agents('mps-aspect-editor', 'Use when creating or changing MPS editor definitions, from a ConceptEditorDeclaration to its cells.'),
      ...agents('mps-aspect-generator', 'Use when defining or modifying MPS generators: root, reduction, weaving and pattern mapping rules.'),
      ...agents('mps-aspect-typesystem', 'Use when authoring or debugging MPS typesystem inference, subtyping and comparison rules.'),
      ...agents('mps-tests', 'Write and run MPS tests: NodesTestCase, EditorTestCase and the generator tests.'),
    ],
  },
  { name: 'intellij-sdk-docs', description: 'IntelliJ Platform SDK documentation', commit: '0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f', skills: [] },
];

const recording: Recording = {
  'https://api.github.com/orgs/JetBrains': { status: 200, body: { login: 'JetBrains' } },
  'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': {
    status: 200,
    body: repositories.map(({ name, description }) => ({ name, full_name: `JetBrains/${name}`, description })),
  },
  'https://api.github.com/orgs/nobody-here': { status: 404, body: { message: 'Not Found' } },
};
for (const { name, commit, skills } of repositories) {
  const api = `https://api.github.com/repos/JetBrains/${name}`;
  recording[api] = { status: 200, body: { full_name: `JetBrains/${name}`, default_branch: 'main' } };
  recording[`${api}/commits/main`] = { status: 200, body: { sha: commit } };
  recording[`https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/${name}&per_page=100&page=1`] = {
    status: 200,
    body: { total_count: skills.length, items: skills.map(({ path }) => ({ path })) },
  };
  for (const skill of skills) {
    recording[`https://raw.githubusercontent.com/JetBrains/${name}/${commit}/${skill.path}`] = {
      status: 200,
      body: `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n`,
    };
  }
}

/** The demo GitHub; each answer waits `delay` ms so the loading states show on video. */
export function demoGitHub(delay = 0): Fetch {
  const answer = replay(recording);
  return async (url, init) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return answer(url, init);
  };
}
