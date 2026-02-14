export function generateSlug(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    slug = 'team';
  }

  if (slug.length > 50) {
    slug = slug.slice(0, 50).replace(/-+$/, '');
  }

  return slug;
}
