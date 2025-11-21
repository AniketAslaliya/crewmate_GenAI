import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';

const sanitize = (s) => {
  if (!s) return '';
  let t = String(s);
  t = t.replace(/[0-9a-fA-F]{8,}/g, '…');
  t = t.replace(/\d{6,}/g, '…');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 120) t = t.slice(0, 117) + '...';
  return t;
};

const timeAgo = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return `${Math.floor(diff/86400)}d`;
  } catch (e) { return ''; }
};

const RecentActivity = ({ maxItems = 4 }) => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user) || {};
  const isLawyer = user?.role === 'lawyer';
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const requestsRoute = isLawyer ? '/api/lawyers/requests' : '/api/lawyers/my-requests';
        const connectionsRoute = isLawyer ? '/api/lawyers/connections/lawyer' : '/api/lawyers/connections/me';

        const calls = [api.get(requestsRoute), api.get(connectionsRoute), api.get('/api/getallchats'), api.get('/api/general-ask/list?_=' + Date.now())];
        const [reqRes, connRes, chatsRes, gaRes] = await Promise.allSettled(calls);

        const out = [];

        if (reqRes.status === 'fulfilled') {
          const rs = reqRes.value.data.requests || [];
          rs.forEach(r => {
            let title = 'Connection request';
            if (isLawyer) {
              // Lawyer receiving request from client
              title = r.from?.name ? `Incoming request from ${r.from.name}` : 'Incoming client request';
            } else {
              // User viewing their own sent requests
              title = r.to?.name ? `Your request to ${r.to.name}` : 'Your connection request';
            }
            out.push({ 
              key: `req-${r._id}`, 
              title, 
              desc: sanitize(r.message || ''), 
              date: r.createdAt || r.updatedAt, 
              route: isLawyer ? '/lawyer/requests' : '/find-lawyer' 
            });
          });
        }

        if (connRes.status === 'fulfilled') {
          const cs = connRes.value.data.connections || [];
          cs.forEach(c => {
            let title = 'Connection';
            if (isLawyer) {
              // Lawyer viewing connection with client
              title = c.from?.name ? `Connected with client ${c.from.name}` : 'Client connection';
            } else {
              // User viewing connection with lawyer
              title = c.to?.name ? `Connected with lawyer ${c.to.name}` : 'Lawyer connection';
            }
            out.push({ 
              key: `conn-${c._id}`, 
              title, 
              desc: sanitize(c.chat?.title || ''), 
              date: c.updatedAt || c.createdAt, 
              route: `/chats/${c.chat?._id || c._id}` 
            });
          });
        }

        if (chatsRes.status === 'fulfilled') {
          const chats = chatsRes.value.data || [];
          // backend returns array of chats; map to legal-desk or notebook
          (Array.isArray(chats) ? chats : []).forEach(ch => out.push({ key: `chat-${ch._id}`, title: ch.title || 'Document', desc: sanitize(ch.owner || ch.user || ''), date: ch.updatedAt || ch.createdAt, route: `/legal-desk/${ch._id}` }));
        }

        if (gaRes.status === 'fulfilled') {
          const list = gaRes.value.data || [];
          if (Array.isArray(list)) {
            list.forEach(g => out.push({ key: `ga-${g._id || g.id}`, title: g.title || 'Guide', desc: sanitize(g.summary || ''), date: g.updatedAt || g.createdAt, route: `/general-ask` }));
          }
        }

        // sort and keep top maxItems
        out.sort((a,b) => new Date(b.date) - new Date(a.date));
        if (mounted) setItems(out.slice(0, maxItems));
      } catch (err) {
        console.error('recent activity failed', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [isLawyer, maxItems, user?.id]);

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Recent activity</h3>
        {/* <button className="text-xs text-primary/80">View all</button> */}
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">No recent activity yet.</div>
      ) : (
        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.key} className="flex items-start justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-md" onClick={() => it.route ? navigate(it.route) : null}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{it.title}</div>
                {/* {it.desc && <div className="text-xs text-gray-500 truncate">{it.desc}</div>} */}
              </div>
              <div className="text-xs text-gray-400 ml-4">{timeAgo(it.date)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecentActivity;
