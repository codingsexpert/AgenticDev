export const getCleanFilename = (filename = '', language = '') => {
  let name = (filename || '').trim();

  // Strip leading comments, slashes, hashes, "file:", "FILE:", "File:", whitespace, etc.
  name = name
    .replace(/^[\/\*<\!#>\-\s]+/g, '')
    .replace(/^file:\s*/i, '')
    .replace(/^file:\s*/i, '')
    .replace(/[\/\*<\!#>\-\s]+$/g, '')
    .trim();

  if (!name || name.toLowerCase() === 'file') {
    const l = (language || '').toLowerCase();
    if (l === 'html') return 'index.html';
    if (l === 'css') return 'style.css';
    if (l === 'js' || l === 'javascript' || l === 'jsx') return 'script.js';
    if (l === 'ts' || l === 'typescript' || l === 'tsx') return 'main.ts';
    if (l === 'py' || l === 'python') return 'main.py';
    if (l === 'cpp' || l === 'c++' || l === 'c') return 'main.cpp';
    if (l === 'bash' || l === 'sh') return 'script.sh';
    if (l === 'json') return 'data.json';
    if (l === 'java') return 'Main.java';
    return `main.${l || 'txt'}`;
  }

  return name;
};
