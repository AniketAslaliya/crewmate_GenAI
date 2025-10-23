import React, { useState, useEffect } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LawyerOnboard = () => {
  const authUser = useAuthStore(s=>s.user);
  const navigate = useNavigate();

  // require login
  useEffect(()=>{
    if(!authUser) navigate('/login');
  },[authUser, navigate]);

  const [bio, setBio] = useState(authUser?.bio || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [specialties, setSpecialties] = useState((authUser?.specialties || []).join(', '));
  const [location, setLocation] = useState(authUser?.location || '');
  const [city, setCity] = useState(authUser?.city || '');
  const [yearsExperience, setYearsExperience] = useState(authUser?.yearsExperience || 0);
  const [fee, setFee] = useState(authUser?.fee || '');
  const [modes, setModes] = useState((authUser?.modes || []).join(', '));
  const [languages, setLanguages] = useState((authUser?.languages || []).join(', '));
  const [courts, setCourts] = useState((authUser?.courts || []).join(', '));
  const [freeFirst, setFreeFirst] = useState(Boolean(authUser?.freeFirst));
  const [firmType, setFirmType] = useState(authUser?.firmType || 'independent');
  const [education, setEducation] = useState((authUser?.education || []).join(', '));
  const [successRate, setSuccessRate] = useState(authUser?.successRate || '');
  const [responseTimeHours, setResponseTimeHours] = useState(authUser?.responseTimeHours || 24);
  const [organization, setOrganization] = useState(authUser?.organization || '');

  const setUser = useAuthStore(s=>s.setUser);

  const submit = async () => {
    try {
      const payload = {
        bio,
        phone,
        specialties: specialties.split(',').map(s=>s.trim()).filter(Boolean),
        location,
        city,
        yearsExperience: Number(yearsExperience) || 0,
        fee: fee ? Number(fee) : 0,
        modes: modes.split(',').map(s=>s.trim()).filter(Boolean),
        languages: languages.split(',').map(s=>s.trim()).filter(Boolean),
        courts: courts.split(',').map(s=>s.trim()).filter(Boolean),
        freeFirst: Boolean(freeFirst),
        firmType,
        education: education.split(',').map(s=>s.trim()).filter(Boolean),
        successRate: successRate ? Number(successRate) : 0,
        responseTimeHours: responseTimeHours ? Number(responseTimeHours) : 24,
        organization,
      };

      await api.post('/api/lawyers/onboard', payload);
      // refresh profile
      const me = await api.get('/auth/me');
      setUser(me.data.user || me.data);
      alert('Onboarded as lawyer');
      navigate('/onboard-lawyer');
    } catch (err) { console.error(err); alert('Failed'); }
  };

  // Determine if the lawyer has completed onboarding (bio or specialties present)
  const isOnboarded = !!(authUser?.bio && authUser.bio.length > 0) || !!(authUser?.specialties && authUser.specialties.length > 0);

  // If user is a lawyer and already onboarded, show a one-time message and hide the form
  if (authUser?.role === 'lawyer' && isOnboarded) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">You're already a lawyer</h2>
        <p className="text-sm text-gray-600">Our records show you are already registered as a lawyer on the platform. If you need to update your profile, go to your account settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Join as Lawyer</h2>
      <div className="max-w-2xl grid grid-cols-1 gap-4">
        <div>
          <label className="block mb-2">Bio</label>
          <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full p-2 border rounded" rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">Phone</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block mb-2">City</label>
            <input value={city} onChange={e=>setCity(e.target.value)} className="w-full p-2 border rounded" placeholder="City e.g. Mumbai" />
          </div>
        </div>

        <div>
          <label className="block mb-2">Specialties (comma separated)</label>
          <input value={specialties} onChange={e=>setSpecialties(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-2">Years Experience</label>
            <input value={yearsExperience} onChange={e=>setYearsExperience(e.target.value)} type="number" min="0" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block mb-2">Fee per session (₹)</label>
            <input value={fee} onChange={e=>setFee(e.target.value)} type="number" min="0" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block mb-2">Firm Type</label>
            <select value={firmType} onChange={e=>setFirmType(e.target.value)} className="w-full p-2 border rounded">
              <option value="independent">Independent</option>
              <option value="firm">Law Firm</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block mb-2">Supported Modes (comma separated)</label>
          <input value={modes} onChange={e=>setModes(e.target.value)} placeholder="in-person, video, chat, phone" className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-2">Languages (comma separated)</label>
          <input value={languages} onChange={e=>setLanguages(e.target.value)} placeholder="English, Hindi" className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-2">Courts (comma separated)</label>
          <input value={courts} onChange={e=>setCourts(e.target.value)} placeholder="District, High Court, Supreme Court" className="w-full p-2 border rounded" />
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block mb-2">Free First Consultation</label>
            <select value={freeFirst ? 'yes' : 'no'} onChange={e=>setFreeFirst(e.target.value === 'yes')} className="w-full p-2 border rounded">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div>
            <label className="block mb-2">Average Success Rate (%)</label>
            <input value={successRate} onChange={e=>setSuccessRate(e.target.value)} type="number" min="0" max="100" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block mb-2">Response Time (hrs)</label>
            <input value={responseTimeHours} onChange={e=>setResponseTimeHours(e.target.value)} type="number" min="0" className="w-full p-2 border rounded" />
          </div>
        </div>

        <div>
          <label className="block mb-2">Education (comma separated)</label>
          <input value={education} onChange={e=>setEducation(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-2">Organization / Law Firm</label>
          <input value={organization} onChange={e=>setOrganization(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div className="mt-4">
          <button onClick={submit} className="px-4 py-2 btn-gradient text-white rounded">Become a Lawyer</button>
        </div>
      </div>
    </div>
  );
};

export default LawyerOnboard;
