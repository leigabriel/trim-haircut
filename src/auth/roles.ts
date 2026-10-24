/**
 * Trim's three account types.
 *
 * The role lives on public.profiles. It is deliberately not user-writable:
 * migration 0008 grants the client update rights on the editable columns only,
 * so a customer cannot promote themselves by writing to their own row.
 */
export type UserRole = 'customer' | 'admin' | 'barber';

export const USER_ROLES: readonly UserRole[] = ['customer', 'admin', 'barber'];

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);

/** The dashboard a role belongs on. */
export const landingFor = (role: UserRole): string => {
  if (role === 'admin') return '/admin';
  if (role === 'barber') return '/barber';
  return '/dashboard';
};

export const roleLabel = (role: UserRole): string => {
  if (role === 'admin') return 'Administrator';
  if (role === 'barber') return 'Barber';
  return 'Customer';
};
