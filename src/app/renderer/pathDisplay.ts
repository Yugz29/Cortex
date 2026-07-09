function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+$/, '');
}

export function displayPathForProject(filePath: string, projectPath: string): string {
  if (!projectPath) return filePath;

  const normalizedFile = normalizePath(filePath);
  const normalizedProject = normalizePath(projectPath);

  if (normalizedFile === normalizedProject) return normalizedFile.split('/').pop() || filePath;

  const prefix = `${normalizedProject}/`;
  if (!normalizedFile.startsWith(prefix)) return filePath;

  return normalizedFile.slice(prefix.length) || filePath;
}
