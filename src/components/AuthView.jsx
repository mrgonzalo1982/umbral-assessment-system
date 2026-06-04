import React, { useState } from 'react';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

const AuthView = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;
      
      const isAllowedEmail = email.endsWith('@colegioumbral.com') || email === 'englishdepartmentrubrics@gmail.com';
      if (!isAllowedEmail) {
        await signOut(auth);
        setError('Acceso denegado. Debes usar una cuenta @colegioumbral.com o la cuenta administradora.');
      } else {
        console.log("Logged into Umbral Rubrics database successfully.");
      }
    } catch (err) {
      console.error("Auth Error Details:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en la consola de Firebase. Debes añadir "umbral-assessment-system.vercel.app" a la lista de dominios autorizados.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Se cerró la ventana de inicio de sesión antes de completar el proceso.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El inicio de sesión con Google no está habilitado en Firebase. Por favor, actívalo en la consola de Firebase.');
      } else {
        setError('Hubo un problema al iniciar sesión: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl shadow-indigo-900/10 p-12 relative z-10 border border-slate-100"
      >
        <div className="flex flex-col items-center text-center space-y-8">

          <div className="space-y-4">
            <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center w-20 h-20 mx-auto mb-6">
              <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-5xl font-black text-indigo-950 italic tracking-tighter leading-none uppercase">
              English <br/>
              <span className="text-rose-500">Department</span>
            </h1>
            <p className="text-indigo-950 font-black text-xl uppercase tracking-tighter">
              Colegio Umbral de Curauma
            </p>
          </div>

          <div className="w-full space-y-6 pt-4">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-rose-100"
              >
                <AlertCircle size={20} />
                {error}
              </motion.div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full group bg-indigo-950 hover:bg-rose-500 text-white rounded-[2rem] py-6 px-8 flex items-center justify-between transition-all duration-500 shadow-xl shadow-indigo-950/10 hover:shadow-rose-500/30 disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Mail size={20} />
                </div>
                <span className="font-black text-xs uppercase tracking-[0.2em]">
                  {loading ? 'Iniciando Sesión...' : 'Ingresar con Correo'}
                </span>
              </div>
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </button>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                <Sparkles size={12} className="text-amber-400" /> Acceso exclusivo para @colegioumbral.com
              </p>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.1em]">
                Diseñado por Gonzalo Flores B.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-50 w-full grid grid-cols-3 gap-4">
            {[
              { label: 'Rubrics AI', icon: '🤖' },
              { label: 'Cloud Sync', icon: '☁️' },
              { label: 'Analytics', icon: '📊' }
            ].map((feat, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="text-xl">{feat.icon}</div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{feat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthView;
