import { motion } from "framer-motion";
import { useState } from 'react';
import api from '../Axios/axios';
import useAuthStore from '../context/AuthContext';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const setToken = useAuthStore(s=>s.setToken);
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(null); // require explicit selection
  const [signupStep, setSignupStep] = useState(1); // 1: choose role, 3: form

  const submit = async () => {
    try{
      let res;
      if(mode === 'signup'){
        // signup is triggered from the final form step
        res = await api.post('/auth/signup', { email, password, name, role });
        if(res.data?.token) setToken(res.data.token);
      }else{
        res = await api.post('/auth/login', { email, password });
        if(res.data?.token) setToken(res.data.token);
      }
      const token = res.data?.token || useAuthStore.getState().token;
      if(token){
        await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        window.location.href = '/home';
      }
    }catch(e){ console.error(e); alert('Auth failed'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
      <div className="max-w-4xl w-full bg-card rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left panel */}
  <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="p-10 flex flex-col justify-center gap-6" style={{ background: 'linear-gradient(135deg, var(--palette-3), var(--palette-2))', color: 'white' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">🤝</div>
            <div>
                <div className="text-xl font-bold">Welcome Back!</div>
                <div className="text-sm opacity-90">To keep connected with us please login with your personal info</div>
            </div>
          </div>
            <div>
              <button onClick={()=>setMode('login')} className={`mr-2 px-4 py-2 rounded-full ${mode==='login' ? 'bg-white text-[var(--palette-2)]' : 'bg-white/20 text-white'}`}>Sign in</button>
              <button onClick={()=>setMode('signup')} className={`px-4 py-2 rounded-full ${mode==='signup' ? 'bg-white text-[var(--palette-2)]' : 'bg-white/20 text-white'}`}>Sign up</button>
            </div>
        </motion.div>

        {/* Right panel - form */}
        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="p-10">
          <h2 className="text-2xl font-bold mb-4">{mode === 'signup' ? (signupStep === 1 ? 'Choose your role' : signupStep === 2 ? 'Why this role?' : 'Create account') : 'Sign in to your account'}</h2>

          <div className="space-y-3">
            {mode === 'signup' && signupStep === 1 && (
              <div className="flex gap-4">
                <div onClick={() => { setRole('helpseeker'); setSignupStep(3); }} className={`cursor-pointer p-4 rounded-lg border ${role === 'helpseeker' ? 'border-[var(--palette-3)] shadow-lg bg-card' : 'border-gray-200'}`} style={{ flex: 1 }}>
                  <h4 className="font-semibold">Helpseeker</h4>
                  <p className="text-sm text-gray-600">I need legal help or advice</p>
                </div>
                <div onClick={() => { setRole('lawyer'); setSignupStep(3); }} className={`cursor-pointer p-4 rounded-lg border ${role === 'lawyer' ? 'border-[var(--palette-3)] shadow-lg bg-card' : 'border-gray-200'}`} style={{ flex: 1 }}>
                  <h4 className="font-semibold">Lawyer</h4>
                  <p className="text-sm text-gray-600">I provide legal services</p>
                </div>
              </div>
            )}

            {/* Benefits step removed — after selecting role we go directly to the form */}

            {mode === 'signup' && signupStep === 3 && (
              <div>
                <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded mb-3" />
                <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border rounded mb-3" />
                <input placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full p-3 border rounded mb-3" />
                <div className="text-sm text-gray-600 mb-3">Selected role: <span className="font-semibold">{role}</span></div>
                <div className="flex gap-3">
                  <button type="button" className="px-4 py-2 border rounded" onClick={() => setSignupStep(1)}>Back</button>
                </div>
              </div>
            )}

            {mode !== 'signup' && (
              <>
                <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border rounded" />
                <input placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full p-3 border rounded" />
              </>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={mode === 'signup' && !role}
              className={`ml-auto px-6 py-3 rounded-full shadow hover:opacity-90 transition ${mode === 'signup' && !role ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'btn-gradient text-white'}`}
            >
              {mode === 'signup' ? 'Sign up' : 'Sign in'}
            </button>

            {mode === 'signup' ? (
              role ? (
                <a href={`${backendUrl}/auth/google?role=${encodeURIComponent(role)}`} className="text-sm text-[var(--color-muted)]">Continue with Google</a>
              ) : (
                <span className="text-sm text-gray-400">Continue with Google</span>
              )
            ) : (
              <a href={`${backendUrl}/auth/google`} className="text-sm text-[var(--color-muted)]">Continue with Google</a>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;