import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';
import Button from '../components/ui/Button';

const FindLawyer = () => {
  const [lawyers, setLawyers] = useState([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [minExp, setMinExp] = useState('');
  const [feeMin, setFeeMin] = useState('');
  const [feeMax, setFeeMax] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [courtFilter, setCourtFilter] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [freeFirst, setFreeFirst] = useState('');
  const [firmType, setFirmType] = useState('');
  const [myLawyers, setMyLawyers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('your');
  const [loading, setLoading] = useState(false);
  const user = useAuthStore(s => s.user);
  const isLawyer = user?.role === 'lawyer';
  const navigate = useNavigate();

  useEffect(()=>{
    if(isLawyer) navigate('/lawyer/requests');
  }, [isLawyer, navigate]);

  useEffect(() => {
  const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/lawyers/list');
        setLawyers(res.data.lawyers || []);
        // fetch user's accepted lawyers
        const my = await api.get('/api/lawyers/connections/me');
        // normalize chat field to be a string id (not an object)
        const normalizedMy = (my.data.connections || []).map(c => ({
          ...c,
          chat: c.chat && typeof c.chat === 'object' ? c.chat._id : c.chat,
        }));
        setMyLawyers(normalizedMy);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetch();
  }, []);

  const requestLawyer = async (lawyerId) => {
    try {
      await api.post('/api/lawyers/request', { to: lawyerId, message: 'Please connect with me' });
      alert('Request sent');
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      if (status === 400) {
        alert('You already have an active request to this lawyer.');
      } else {
        alert('Failed to send request.');
      }
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Find a Lawyer</h2>

      {/* Tabs */}
      <div className="flex items-center gap-6 mb-6">
        <button 
          onClick={() => setSelectedTab('your')}
          className={`text-lg font-semibold pb-2 ${selectedTab === 'your' ? 'border-b-2' : 'text-gray-600'}`}
          style={selectedTab === 'your' ? { borderColor: 'var(--palette-3)', color: 'var(--color-primary)' } : {}}
        >
          Your Lawyers
        </button>
        <button
          onClick={() => setSelectedTab('find')}
          className={`text-lg font-semibold pb-2 ${selectedTab === 'find' ? 'border-b-2' : 'text-gray-600'}`}
          style={selectedTab === 'find' ? { borderColor: 'var(--palette-3)', color: 'var(--color-primary)' } : {}}
        >
          Find Lawyers
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {selectedTab === 'your' ? (
            <div>
              {myLawyers.length === 0 ? (
                <div className="text-gray-600">You have no connected lawyers yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {myLawyers.map(m => (
                    <div key={m._id} className="p-4 border rounded">
                      <div className="flex items-center gap-3">
                        <img src={m.to.picture} alt="" className="w-12 h-12 rounded-full" />
                        <div>
                          <div className="font-semibold">{m.to.name}</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        {m.chat ? (
                          !isLawyer ? (
                            <a href={`/chat/${typeof m.chat === 'object' ? m.chat._id : m.chat}`} className="px-3 py-1 btn-gradient text-white rounded">Open Chat</a>
                          ) : (
                            <span className="text-sm text-gray-500">Chat (hidden for lawyers)</span>
                          )
                        ) : (
                          <span className="text-sm text-gray-500">No chat yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Left filters */}
              <aside className="w-72 panel p-6 rounded-lg border">
                <div className="mb-4">
                  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search lawyers..." className="w-full p-3 rounded border" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input value={city} onChange={e=>setCity(e.target.value)} placeholder="City e.g. Mumbai" className="w-full p-2 rounded border" list="city-list" />
                  <datalist id="city-list">
                    <option>New Delhi</option>
                    <option>Mumbai</option>
                    <option>Bengaluru</option>
                    <option>Chennai</option>
                    <option>Hyderabad</option>
                  </datalist>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Area of Specialization</label>
                  <input value={specialization} onChange={e=>setSpecialization(e.target.value)} placeholder="e.g. Criminal" className="w-full p-2 rounded border" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Min Years Experience</label>
                  <input value={minExp} onChange={e=>setMinExp(e.target.value)} type="number" min="0" className="w-full p-2 rounded border" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Fee Range (₹)</label>
                  <div className="flex gap-2">
                    <input value={feeMin} onChange={e=>setFeeMin(e.target.value)} placeholder="Min" className="w-1/2 p-2 rounded border" />
                    <input value={feeMax} onChange={e=>setFeeMax(e.target.value)} placeholder="Max" className="w-1/2 p-2 rounded border" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Mode</label>
                  <select value={modeFilter} onChange={e=>setModeFilter(e.target.value)} className="w-full p-2 rounded border">
                    <option value="">Any</option>
                    <option value="in-person">In-person</option>
                    <option value="video">Video Call</option>
                    <option value="chat">Chat</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Languages</label>
                  <input value={languageFilter} onChange={e=>setLanguageFilter(e.target.value)} placeholder="English, Hindi" className="w-full p-2 rounded border" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Court</label>
                  <input value={courtFilter} onChange={e=>setCourtFilter(e.target.value)} placeholder="High Court" className="w-full p-2 rounded border" />
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)} /> <label className="text-sm">Verified / Licensed</label>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Min Rating</label>
                  <input value={minRating} onChange={e=>setMinRating(e.target.value)} type="number" min="0" max="5" step="0.1" className="w-full p-2 rounded border" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Free First Consultation</label>
                  <select value={freeFirst} onChange={e=>setFreeFirst(e.target.value)} className="w-full p-2 rounded border">
                    <option value="">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Firm Type</label>
                  <select value={firmType} onChange={e=>setFirmType(e.target.value)} className="w-full p-2 rounded border">
                    <option value="">Any</option>
                    <option value="independent">Independent</option>
                    <option value="firm">Law Firm</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => {
                    setQuery(''); setCity(''); setSpecialization(''); setMinExp(''); setFeeMin(''); setFeeMax(''); setModeFilter(''); setLanguageFilter(''); setCourtFilter(''); setVerifiedOnly(false); setMinRating(''); setFreeFirst(''); setFirmType('');
                  }} className="px-3 py-2 border rounded">Reset</button>
                </div>
              </aside>

              {/* Results grid */}
              <div className="flex-1">
                {(() => {
                  const connectedIds = new Set((myLawyers || []).map(c => c.to?._id || c.to));
                  const available = (lawyers || []).filter(l => !connectedIds.has(l._id));

                  // client-side filters
                  const filtered = available.filter(l => {
                    if (query && !(`${l.name} ${l.specialties?.join(' ')} ${l.bio}`).toLowerCase().includes(query.toLowerCase())) return false;
                    if (city && (!l.city || !l.city.toLowerCase().includes(city.toLowerCase()))) return false;
                    if (specialization && !(l.specialties || []).some(s => s.toLowerCase().includes(specialization.toLowerCase()))) return false;
                    if (minExp && (!(l.yearsExperience >= Number(minExp)))) return false;
                    if (feeMin && (!(l.fee && l.fee >= Number(feeMin)))) return false;
                    if (feeMax && (!(l.fee && l.fee <= Number(feeMax)))) return false;
                    if (modeFilter && !(l.modes || []).includes(modeFilter)) return false;
                    if (languageFilter && !((l.languages || []).join(' ').toLowerCase().includes(languageFilter.toLowerCase()))) return false;
                    if (courtFilter && !((l.courts || []).join(' ').toLowerCase().includes(courtFilter.toLowerCase()))) return false;
                    if (verifiedOnly && !l.verified) return false;
                    if (minRating && !(l.rating >= Number(minRating))) return false;
                    if (freeFirst === 'yes' && !l.freeFirst) return false;
                    if (freeFirst === 'no' && l.freeFirst) return false;
                    if (firmType && l.firmType !== firmType) return false;
                    return true;
                  });

                  if (filtered.length === 0) return <div className="text-gray-600">No available lawyers match your filters.</div>;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {filtered.map(l => (
    <div
      key={l._id}
  className="relative group bg-card border rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300" style={{ borderColor: 'var(--palette-3)' }}
    >
      {/* Top Badge */}
      <div className="absolute top-4 right-4">
        {l.verified && (
          <span className="px-2 py-1 text-[10px] font-semibold bg-green-100 text-green-700 rounded-full flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Verified
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <img
          src={l.picture || `https://avatar.vercel.sh/${l._id}`}
          alt={l.name}
          className="w-16 h-16 rounded-full ring-2 ring-[var(--palette-4)] object-cover"
        />
        <div className="flex-1">
          <h2 className="font-semibold text-lg text-gray-900">{l.name}</h2>
          <p className="text-sm text-gray-500">{l.organization || l.firm || 'Independent Lawyer'}</p>
          <p className="text-xs text-gray-400">{l.city}</p>
        </div>
      </div>

      {/* Bio */}
      <p className="mt-3 text-sm text-gray-700 line-clamp-3">{l.bio || 'No bio available.'}</p>

      {/* Specialties */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(l.specialties || []).slice(0, 4).map(s => (
          <span key={s} className="text-xs px-2 py-1 bg-[var(--palette-4)] text-white rounded-full">
            {s}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-5 flex justify-between items-center text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-yellow-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.956a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.956c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.785.57-1.84-.197-1.54-1.118l1.286-3.956a1 1 0 00-.364-1.118L2.013 9.383c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.956z" />
            </svg>
            <span>{l.rating || '—'}</span>
          </div>
          <div className="text-gray-500">{l.yearsExperience ? `${l.yearsExperience} yrs` : '— yrs'}</div>
        </div>

        <div className="text-right">
          <div className="font-semibold text-[var(--palette-4)]">₹{l.fee || '—'}</div>
          <div className="text-xs text-gray-500">{l.fee ? '/session' : ''}</div>
        </div>
      </div>

      {/* Button */}
      <div className="mt-6">
        <Button variant="primary" className="w-full" onClick={() => requestLawyer(l._id)}>Request Consultation</Button>
      </div>
    </div>
  ))}
</div>

                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FindLawyer;
