import { useState, useEffect } from 'react'
import { useAuthStore } from '../hooks/useAuth'
import { Wifi, Eye, EyeOff, Loader2, Shield } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { login, loading, error } = useAuthStore()

  useEffect(() => {
    const saved = localStorage.getItem('saved_username')
    if (saved) setUsername(saved)
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(username, password, rememberMe)
    if (ok) localStorage.setItem('saved_username', username)
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-mesh dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className={`relative z-10 w-full max-w-md mx-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary shadow-lg shadow-primary/25 mb-5 animate-float">
            <Wifi size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            إدارة شبكات WiFi
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            سجّل دخولك للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-white/50 dark:border-gray-700/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="أدخل اسم المستخدم"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 pl-12"
                  placeholder="أدخل كلمة المرور"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 peer-checked:border-primary peer-checked:bg-primary transition-all flex items-center justify-center">
                    <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                  تذكرني
                </span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="animate-fade-in bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-sm border border-red-200/80 dark:border-red-800/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Shield size={12} />
          <span>اتصال آمن ومشفّر</span>
        </div>
      </div>
    </div>
  )
}