// Dynamically load all markdown files from the top-level docs directory
const markdownFiles = import.meta.glob('../../../docs/**/*.md', { query: '?raw', import: 'default', eager: true });

// Also load the root README.md
const rootReadme = import.meta.glob('../../../readme.md', { query: '?raw', import: 'default', eager: true });

export const getDocContent = (relativePath) => {
  if (!relativePath || relativePath === 'README.md' || relativePath === '/' || relativePath === 'overview') {
    return markdownFiles['../../../docs/README.md'] || '';
  }

  // Normalize path
  let cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  if (!cleanPath.endsWith('.md')) {
    cleanPath += '.md';
  }

  // Try exact match
  const directKey = `../../../docs/${cleanPath}`;
  if (markdownFiles[directKey]) {
    return markdownFiles[directKey];
  }

  // Search by filename match
  const matchedKey = Object.keys(markdownFiles).find(k => k.endsWith(`/${cleanPath}`));
  if (matchedKey) {
    return markdownFiles[matchedKey];
  }

  return null;
};

export const getAllDocKeys = () => {
  return Object.keys(markdownFiles).map(k => k.replace('../../../docs/', ''));
};
