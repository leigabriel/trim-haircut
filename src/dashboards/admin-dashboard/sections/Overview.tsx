import SectionHead from '../../shell/SectionHead';
import { roleLabel } from '../../../auth/roles';
import type { AccountsState } from '../useAccounts';

interface AdminOverviewProps {
  accounts: AccountsState;
}

const joined = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Admin landing section. Every figure is counted from the live account list,
 * so an unapplied migration reads as "—" rather than a plausible zero.
 */
const AdminOverview: React.FC<AdminOverviewProps> = ({ accounts }) => {
  const { accounts: rows, isLoading, error, reload } = accounts;

  const value = (count: number): string => {
    if (isLoading) return '…';
    if (error) return '—';
    return String(count);
  };

  const total = rows.length;
  const customers = rows.filter((row) => row.role === 'customer').length;
  const barbers = rows.filter((row) => row.role === 'barber').length;
  const admins = rows.filter((row) => row.role === 'admin').length;
  const newest = rows.slice(0, 5);

  return (
    <>
      <SectionHead
        title="Overview"
        lede="Every account on Trim, counted from the profiles table. Role changes happen in User Manager."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Accounts</p>
          <p className="trim-metric__value">{value(total)}</p>
          <p className="trim-metric__delta">Registered in total</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Customers</p>
          <p className="trim-metric__value">{value(customers)}</p>
          <p className="trim-metric__delta">Can book and chat</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Barbers</p>
          <p className="trim-metric__value">{value(barbers)}</p>
          <p className="trim-metric__delta">Can run a chair</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Admins</p>
          <p className="trim-metric__value">{value(admins)}</p>
          <p className="trim-metric__delta">Full access</p>
        </li>
      </ul>

      {error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Account list unavailable</h2>
          <p className="trim-card__text">{error}</p>
          <button className="trim-account__analyze" type="button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="trim-card">
        <h2 className="trim-card__title">Newest accounts</h2>

        {newest.length === 0 ? (
          <p className="trim-card__text">
            {isLoading ? 'Reading accounts…' : 'No accounts to show yet.'}
          </p>
        ) : (
          <ul className="trim-saved">
            {newest.map((account) => (
              <li className="trim-saved__row" key={account.id}>
                <span className="trim-saved__text">
                  <span className="trim-saved__name">
                    {account.username ?? account.displayName ?? 'No username'}
                  </span>
                  <span className="trim-saved__meta">
                    {account.email} · {roleLabel(account.role)} · joined {joined(account.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default AdminOverview;
