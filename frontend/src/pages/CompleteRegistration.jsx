import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/AuthContext';
import api from '../Axios/axios';

const RoleCard = ({ role, title, description, selected, onClick }) => (
  <div
    onClick={() => onClick(role)}
  className={`cursor-pointer p-6 rounded-2xl border transition-shadow duration-200 ${selected ? 'shadow-2xl border-[var(--palette-3)] bg-card' : 'bg-surface'}`}
    style={{ minWidth: 220 }}
  >
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);

const CompleteRegistration = () => {
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState(authUser?.name || '');
  const [email, setEmail] = useState(authUser?.email || authUser?.username || '');
  const [loading, setLoading] = useState(false);

  const benefits = {
    helpseeker: [
      'Ask clear legal questions and get fast AI summaries',
      'Secure document uploads and private Legal Desks',
      'Connect with vetted lawyers for paid help',
    ],
    lawyer: [
      'Receive client requests and manage cases',
      'Showcase expertise and onboard clients',
      'Access advanced lawyer-only tools and billing',
    ],
  };

  const handleRolePick = (role) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleContinueToForm = () => {
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) return alert('Please choose a role');
    setLoading(true);
    try {
      // Use existing set-role endpoint; include optional profile fields
      await api.post(
        '/auth/set-role',
        { role: selectedRole, name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // refresh profile
      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      setUser(me.data.user || me.data);
      navigate('/home');
    } catch (err) {
      console.error(err);
      alert('Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 flex items-start justify-center p-8">
  <div className="w-full max-w-3xl bg-card rounded-3xl shadow-xl p-8" style={{ borderColor: 'var(--palette-3)' }}>
        <h2 className="text-2xl font-bold mb-4">Finish creating your account</h2>
        <p className="text-sm text-gray-600 mb-6">A couple of quick steps to tailor your experience.</p>

        {step === 1 && (
          <div className="flex gap-6">
            <RoleCard
              role="helpseeker"
              title="Helpseeker"
              description="I need legal help or advice"
              selected={selectedRole === 'helpseeker'}
              onClick={handleRolePick}
            />
            <RoleCard
              role="lawyer"
              title="Lawyer"
              description="I provide legal services"
              selected={selectedRole === 'lawyer'}
              onClick={handleRolePick}
            />
          </div>
        )}

        {step === 2 && selectedRole && (
          <div>
            <h3 className="text-xl font-semibold mb-3">Why {selectedRole === 'lawyer' ? 'Lawyers' : 'Helpseekers'} love Legal SahAI</h3>
            <ul className="list-disc ml-6 mb-6 text-gray-700">
              {benefits[selectedRole].map((b, i) => (
                <li key={i} className="mb-2">{b}</li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button className="px-4 py-2 btn-gradient text-white rounded" onClick={handleContinueToForm}>Continue</button>
              <button className="px-4 py-2 border rounded" onClick={() => setStep(1)}>Back</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-600">Selected role</label>
                <div className="font-semibold">{selectedRole}</div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="px-4 py-2 border rounded" onClick={() => setStep(2)}>Back</button>
                <button type="submit" disabled={loading} className="px-4 py-2 btn-gradient text-white rounded">{loading ? 'Saving...' : 'Finish'}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CompleteRegistration;
