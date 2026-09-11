import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Users } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../context/AuthContext';

interface ActiveUser {
  id: number;
  name: string;
  email: string;
  role: string;
  hospital_id: number | null;
  hospital_name: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  is_online: boolean;
}

interface ActiveUsersPanelProps {
  /** Only a super admin may look at another tenant; omitted otherwise. */
  hospitalId?: string;
}

/** "3 minutes ago" — short, and without pulling in a date library. */
const sinceLabel = (iso: string | null): string => {
  if (!iso) return '—';

  const then = new Date(iso.replace(' ', 'T')).getTime();
  if (Number.isNaN(then)) return '—';

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
};

/** Initials for the avatar, from at most the first two words of the name. */
const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/**
 * Who is signed in, per hospital.
 *
 * Online means the account's API token was used within the server's activity
 * window -- a token-authenticated app has no logout event to rely on, so
 * "still working" is the only honest signal. Everyone else is listed with
 * when they were last seen, which is the question a supervisor actually asks.
 */
export function ActiveUsersPanel({ hospitalId }: ActiveUsersPanelProps) {
  const { t } = useTranslation();
  const { hasPermission, user } = useAuth();

  const [rows, setRows] = useState<ActiveUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const allowed =
    user?.role === 'super_admin' ||
    hasPermission('view_dashboard_active_users') ||
    hasPermission('view_users') ||
    hasPermission('manage_users');

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/dashboard/active-users', {
        params: hospitalId ? { hospital_id: hospitalId } : {},
      });
      setRows(Array.isArray(data?.data) ? data.data : []);
      setOnlineCount(Number(data?.online_count) || 0);
      setWindowMinutes(Number(data?.window_minutes) || 15);
      setFailed(false);
    } catch {
      // A dashboard tile that cannot load is not worth a toast on every
      // refresh; the panel says so quietly instead.
      setFailed(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  // Online first; the server already sorts, but re-derive so the split is
  // explicit and the two groups can be headed separately.
  const { online, recent } = useMemo(
    () => ({
      online: rows.filter((row) => row.is_online),
      recent: rows.filter((row) => !row.is_online).slice(0, 8),
    }),
    [rows]
  );

  if (!allowed) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-indigo-500" />
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          {t('ui.loggedInUsers', 'Logged-in Users')}
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30">
          <span className="relative flex h-1.5 w-1.5">
            {onlineCount > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                onlineCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            />
          </span>
          {onlineCount} {t('ui.online', 'online')}
        </span>
        <button
          type="button"
          onClick={load}
          title={t('ui.refresh', 'Refresh')}
          className="ms-auto p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {failed ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
          {t('ui.couldNotLoad', 'Could not load')}
        </p>
      ) : loading && rows.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
          {t('ui.loading', 'Loading...')}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
          {t('ui.noUsers', 'No users to show')}
        </p>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pe-1">
          {online.length > 0 && (
            <div className="space-y-1.5">
              {online.map((row) => (
                <UserRow key={row.id} row={row} />
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5 mt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('ui.recentlyActive', 'Recently active')}
                </span>
                <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="space-y-1.5">
                {recent.map((row) => (
                  <UserRow key={row.id} row={row} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
        {t('ui.onlineWindowHint', 'Online means active in the last {{n}} minutes', { n: windowMinutes })}
      </p>
    </div>
  );
}

function UserRow({ row }: { row: ActiveUser }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
      <div className="relative shrink-0">
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white ${
            row.is_online ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'
          }`}
        >
          {initials(row.name)}
        </span>
        {row.is_online && (
          <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{row.name}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {row.role}
          {row.hospital_name ? ` · ${row.hospital_name}` : ''}
        </p>
      </div>

      <span
        className={`text-[10px] tabular-nums shrink-0 ${
          row.is_online
            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {sinceLabel(row.last_seen_at ?? row.last_login_at)}
      </span>
    </div>
  );
}
