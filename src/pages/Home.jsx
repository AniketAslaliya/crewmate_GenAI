import React from "react";
import { motion } from "framer-motion";
import api from '../Axios/axios';
import { useNavigate } from "react-router-dom";
import Button from '../components/ui/Button';
import DailyLegalDose from '../components/DailyLegalDose';
import useAuthStore from '../context/AuthContext';
import { formatDisplayName } from '../utils/name';

const QuickCard = ({ title, desc, emoji, onClick }) => (
  <div className="bg-white/90 border rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer" onClick={onClick}>
    <div className="flex items-start gap-3">
      <div className="w-12 h-12 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center text-xl font-bold">{emoji}</div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-1">{desc}</div>
      </div>
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();

  const authUser = useAuthStore(s => s.user) || {};
  const isLawyer = authUser?.role === 'lawyer';
  const [recent, setRecent] = React.useState([]);
  const [recentLoading, setRecentLoading] = React.useState(false);

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

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setRecentLoading(true);
      try {
        let items = [];
        if (isLawyer) {
          const [pRes, aRes] = await Promise.all([
            api.get('/api/lawyers/requests'),
            api.get('/api/lawyers/connections/lawyer')
          ]);
          const pending = (pRes.data.requests || []).map(r => ({
            key: `req-${r._id}`,
            title: r.from?.name ? `Request from ${r.from.name}` : 'Incoming request',
            desc: r.message || '',
            date: r.createdAt || r.updatedAt,
          }));
          const accepted = (aRes.data.connections || []).map(c => ({
            key: `conn-${c._id}`,
            title: c.from?.name ? `Connected with ${c.from.name}` : 'Accepted connection',
            desc: c.chat?.title || '',
            date: c.updatedAt || c.createdAt,
          }));
          items = [...pending, ...accepted];
        } else {
          const [pRes, aRes] = await Promise.all([
            api.get('/api/lawyers/my-requests'),
            api.get('/api/lawyers/connections/me')
          ]);
          const myRequests = (pRes.data.requests || []).map(r => ({
            key: `req-${r._id}`,
            title: `You requested ${r.to?.name || 'a lawyer'}`,
            desc: r.message || '',
            date: r.createdAt || r.updatedAt,
          }));
          const myAccepted = (aRes.data.connections || []).map(c => ({
            key: `conn-${c._id}`,
            title: `Connection with ${c.to?.name || 'a lawyer'}`,
            desc: c.chat?.title || '',
            date: c.updatedAt || c.createdAt,
          }));
          items = [...myRequests, ...myAccepted];
        }

        // sort by date desc and take first 6
        items = items.map(it => ({ ...it, date: it.date || new Date().toISOString() }));
        items.sort((a,b) => new Date(b.date) - new Date(a.date));
        if (mounted) setRecent(items.slice(0,6).map(it => ({ ...it, time: timeAgo(it.date) })));
      } catch (err) {
        console.error('failed to load recent activity', err);
      } finally {
        if (mounted) setRecentLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [isLawyer]);
  // const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser.specialties.length > 0));

  // role-aware quick action sets
  let quickActions = [];
  if (isLawyer) {
    // Lawyers (onboarded or not) get lawyer-centric actions
    quickActions = [
      { title: 'Requests', desc: 'View incoming client requests', emoji: '🔔', route: '/lawyer/requests' },
      { title: 'My Clients', desc: 'Manage your clients and cases', emoji: '👥', route: '/mylawyers' },
      { title: 'Chat with Clients', desc: 'Chat with clients and discuss cases', emoji: '💬', route: '/chats?target=client' },
      { title: 'AutoFill Forms', desc: 'Upload & auto-fill client PDFs', emoji: '📝', route: '/forms/auto-fill' },
      { title: 'Legal Desks', desc: 'Got a specific document? Upload it and ask questions directly about its content. I\'ll help you find key details, summarize sections, and understand complex text.', emoji: '📁', route: '/legal-desk' },
      // { title: isOnboarded ? 'Profile' : 'Complete Onboarding', desc: isOnboarded ? 'View your profile' : 'Finish onboarding to accept clients', emoji: '⚙️', route: isOnboarded ? '/profile' : '/onboard-lawyer' }
    ];
  } else {
    // Helpseekers / regular users
    quickActions = [
      { title: 'Find Lawyer', desc: 'Search and connect with lawyers nearby', emoji: '🔍', route: '/find-lawyer' },
      { title: 'Chat with a Lawyer', desc: 'Get quick legal help via chat', emoji: '💬', route: '/chats?target=lawyer' },
      { title: 'AutoFill Forms', desc: 'Upload & auto-fill PDFs quickly', emoji: '📝', route: '/forms/auto-fill' },
      { title: 'Legal Desks', desc: ' Upload document and ask questions directly about its content.', emoji: '📁', route: '/legal-desk' },
      // { title: 'Notebook', desc: 'Save notes and AI summaries', emoji: '📒', route: '/notebook' },
      // { title: 'Support', desc: 'Get help from our team', emoji: '🆘', route: '/support' }
    ];
  }

  return (
    <div className="relative w-full text-[var(--text)] font-sans bg-[var(--bg)] min-h-screen flex flex-col">
      <main className={`flex-1 min-h-0 overflow-auto px-6 py-8`}> 
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-card rounded-2xl border p-8 mb-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-extrabold">Welcome back, {formatDisplayName(authUser.name) || 'Guest'}</h1>
                  <p className="text-sm text-gray-600 mt-1">Quick access to common features and your daily legal insight.</p>
                </div>
                <div className="flex items-center gap-4">
                 
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate('/legal-desk')} className="py-2 px-4 rounded-lg">Go to Legal Desks</Button>
                    <Button variant="primary" onClick={() => navigate('/forms/auto-fill')}>Upload a Form</Button>
                  </div>
                </div>
              </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {quickActions.slice(0,4).map(a => (
                  <QuickCard key={a.title} title={a.title} desc={a.desc} emoji={a.emoji} onClick={() => navigate(a.route)} />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {quickActions.slice(4).map(a => (
                  <QuickCard key={a.title} title={a.title} desc={a.desc} emoji={a.emoji} onClick={() => navigate(a.route)} />
                ))}
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-6 bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
                {recentLoading ? (
                  <div className="text-sm text-gray-500">Loading recent activity…</div>
                ) : recent.length === 0 ? (
                  <div className="text-sm text-gray-500">No recent activity — start by uploading a document or creating a Legal Desk.</div>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {recent.map((it) => (
                      <li key={it.key} className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-gray-500">{it.desc}</div>
                        </div>
                        <div className="text-xs text-gray-400 ml-4">{it.time}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </div>

            <aside className="space-y-4">
              <DailyLegalDose />
              <div className="bg-white border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Quick tips</h4>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li>• Upload PDFs to AutoFill and let the assistant detect fields.</li>
                  <li>• Use Legal Desks to keep documents organized per case.</li>
                  <li>• Chat for quick legal clarifications before contacting a lawyer.</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;