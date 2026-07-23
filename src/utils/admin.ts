export function isAdminUser(user: any): boolean {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === 'thpark119@gmail.com';
}
