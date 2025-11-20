import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from '../Axios/axios';
import Button from '../components/ui/Button';
import DailyLegalDose from '../components/DailyLegalDose';
import RecentActivity from '../components/RecentActivity';
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
  const [showMore, setShowMore] = useState(false);
  const moreQuestions = [
    'How do I file for divorce?',
    'What should I do if I am arrested?',
    'How can I write a will?',
    'How do I get child custody?',
    'What are my rights if I am wrongfully terminated?',
    'How do I contest a traffic ticket?',
    'What is the statute of limitations for a contract claim?',
    'How can I report workplace harassment?',
    'How do I register a trademark?',
    'What are the steps to start a small business?',
    'Can I change my name legally?',
    'How do I handle a landlord dispute?'
  ];

  // When user clicks Ask in the expanded "View more" area, pass the question
  // to the GeneralAsk page (Quick Guide) and let that page perform the query.
  // We attempt to create a persistent chat first (best-effort) so GeneralAsk
  // receives a chatId if available.
  const handleAskInline = async (question) => {
    try {
      let chatId = null;
      try {
        const res = await api.post('/api/general-ask/create', { title: question.slice(0,60) });
        chatId = res?.data?.chat?._id || null;
      } catch (e) {
        // ignore create errors; GeneralAsk will create if needed
      }
      if (chatId) navigate('/general-ask', { state: { startQuestion: question, chatId } });
      else navigate('/general-ask', { state: { startQuestion: question } });
    } catch (e) {
      // fallback navigation
      navigate('/general-ask', { state: { startQuestion: question } });
    }
  };

  const authUser = useAuthStore(s => s.user) || {};
  const isLawyer = authUser?.role === 'lawyer';
  const verificationStatus = authUser?.verificationStatus;
  const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser.specialties.length > 0));

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
    // hide any accidental horizontal overflow and keep vertical scrolling
    <div className="relative w-full text-[var(--text)] font-sans bg-[var(--bg)] min-h-screen flex flex-col overflow-x-hidden">
      <main className={`flex-1 min-h-0 overflow-auto px-4 py-8`}> 
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

          {/* Lawyer Verification Status Banner */}
          {isLawyer && isOnboarded && (
            <>
              {verificationStatus === 'pending' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-yellow-900">Profile Under Review</h3>
                      <p className="text-xs text-yellow-800 mt-1">
                        Your lawyer profile is being verified by our admin team. You'll be notified once approved. This typically takes 24-48 hours.
                      </p>
                      <button
                        onClick={() => navigate('/onboard-lawyer')}
                        className="mt-2 text-xs text-yellow-700 hover:text-yellow-900 font-medium underline"
                      >
                        View Status Details →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {verificationStatus === 'rejected' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-red-900">Verification Declined</h3>
                      <p className="text-xs text-red-800 mt-1">
                        Your lawyer profile verification was not approved. Please review the feedback and resubmit your application.
                      </p>
                      <button
                        onClick={() => navigate('/onboard-lawyer')}
                        className="mt-2 text-xs text-red-700 hover:text-red-900 font-medium underline"
                      >
                        View Rejection Details & Resubmit →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {verificationStatus === 'approved' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-green-900">Profile Verified! 🎉</h3>
                      <p className="text-xs text-green-800 mt-1">
                        Your lawyer profile is verified and active. You can now accept client requests and appear in the lawyer directory.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* Quick Guide shortcuts */}
          {!isLawyer && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Quick Guide</h2>
              <button onClick={() => setShowMore(s => !s)} className="text-sm text-primary/80">{showMore ? 'View less' : 'View more'}</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'How do I file for divorce?',
                'What should I do if I am arrested?',
                'How can I write a will?',
                'How do I get child custody?',
                'What are my rights if I am wrongfully terminated?',
              ].slice(0,4).map((q) => (
                <button key={q} onClick={async () => {
                  try {
                    // create a persistent Quick Guide chat and redirect with state so GeneralAsk auto-sends
                    const res = await api.post('/api/general-ask/create', { title: q.slice(0,60) });
                    const chat = res?.data?.chat;
                    const chatId = chat?._id;
                    navigate('/general-ask', { state: { startQuestion: q, chatId } });
                  } catch (e) {
                    // fallback: navigate with question only (GeneralAsk will create a new chat)
                    navigate('/general-ask', { state: { startQuestion: q } });
                  }
                }} className="text-left p-3 bg-white border rounded-lg hover:shadow-sm">{q}</button>
              ))}
            </div>
            {/* expanded "view more" area: show additional questions and allow asking inline without redirect */}
            {showMore && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {moreQuestions.map((q) => (
                  <div key={q} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-left">{q}</div>
                      <div>
                        <button onClick={() => handleAskInline(q)} className="text-xs text-primary/90 px-2 py-1 border rounded">Ask</button>
                      </div>
                    </div>
                    {/* answers are handled in GeneralAsk; no inline reply here */}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

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

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-6">
                <RecentActivity maxItems={2} />
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