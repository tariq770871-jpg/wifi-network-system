import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../services/auth.service'
import { usersApi } from '../../services/users.service'
import { useAuthStore } from '../../hooks/useAuth'
import { User, Lock, Save, MapPin, Eye, EyeOff, Palette, Sun, Moon, Monitor, Loader2, Shield, ShieldCheck, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'

const THEME_KEY = 'theme'

const themeOptions = [
  { value: 'light', label: 'وضع فاتح', icon: Sun, desc: 'خلفية فاتحة مريحة للعين' },
  { value: 'dark', label: 'وضع داكن', icon: Moon, desc: 'مثالي للاستخدام الليلي' },
  { value: 'auto', label: 'تلقائي', icon: Monitor, desc: 'يتبع إعدادات النظام' },
]

export default function SettingsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')

  const { data: meData } = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const current = meData?.data || user || {}

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [themeMode, setThemeMode] = useState('light')

  useEffect(() => {
    if (current.full_name) {
      setFullName(current.full_name)
      setPhone(current.phone || '')
      setEmail(current.email || '')
    }
  }, [current.full_name, current.phone, current.email])

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'auto') setThemeMode(saved)
  }, [])

  const profileMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (res) => {
      toast.success('تم تحديث الملف الشخصي بنجاح')
      const updated = res?.data
      if (updated) {
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage
        storage.setItem('user', JSON.stringify({ ...user, ...updated }))
        useAuthStore.setState({ user: { ...user, ...updated } })
      }
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ current_password, new_password }) => authApi.changePassword(current_password, new_password),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const vetoMutation = useMutation({
    mutationFn: (veto) => usersApi.vetoTracking(veto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('تم التحديث بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const handleProfileSave = () => {
    profileMutation.mutate({ full_name: fullName, phone, email })
  }

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة')
      return
    }
    if (newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    passwordMutation.mutate({ current_password: currentPassword, new_password: newPassword })
  }

  const applyTheme = (mode) => {
    setThemeMode(mode)
    localStorage.setItem(THEME_KEY, mode)
    window.dispatchEvent(new Event('theme-change'))
  }

  const roleConfig = {
    admin: { label: 'مدير النظام', icon: Shield, color: 'text-red-600 dark:text-red-400' },
    support: { label: 'دعم فني', icon: ShieldCheck, color: 'text-blue-600 dark:text-blue-400' },
    technician: { label: 'فني', icon: Wrench, color: 'text-emerald-600 dark:text-emerald-400' },
  }
  const currentRole = roleConfig[current.role] || roleConfig.technician
  const RoleIcon = currentRole.icon

  const tabs = [
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'password', label: 'كلمة المرور', icon: Lock },
    { id: 'appearance', label: 'المظهر', icon: Palette },
  ]

  const inputClass = "input-field w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الإعدادات</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة حسابك وتفضيلاتك</p>
      </div>

      {/* User Info Card */}
      <div className="card p-6 animate-fade-in">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl gradient-primary text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-primary/20">
            {current.full_name?.[0] || 'U'}
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{current.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">@{current.username}</span>
              <span className="text-gray-300 dark:text-gray-600">&middot;</span>
              <span className={`inline-flex items-center gap-1 text-sm font-medium ${currentRole.color}`}>
                <RoleIcon size={14} />
                {currentRole.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'gradient-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-6 space-y-5 animate-fade-in-scale">
          <div className="flex items-center gap-3 mb-1">
            <div className="gradient-primary p-2 rounded-lg text-white"><User size={18} /></div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">الملف الشخصي</h2>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">اسم المستخدم</label>
            <input type="text" value={current.username || ''} disabled className={`${inputClass} bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الاسم الكامل</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">رقم الجوال</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="05xxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" />
          </div>
          <div className="pt-2">
            <button
              onClick={handleProfileSave}
              disabled={profileMutation.isPending}
              className="btn-primary flex items-center gap-2 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><Save size={16} /> حفظ التغييرات</>}
            </button>
          </div>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="card p-6 space-y-5 animate-fade-in-scale">
          <div className="flex items-center gap-3 mb-1">
            <div className="gradient-orange p-2 rounded-lg text-white"><Lock size={18} /></div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">تغيير كلمة المرور</h2>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">كلمة المرور الحالية</label>
            <div className="relative">
              <input type={showCurrentPwd ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass + ' pl-12'} placeholder="أدخل كلمة المرور الحالية" />
              <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5">
                {showCurrentPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">كلمة المرور الجديدة</label>
            <div className="relative">
              <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass + ' pl-12'} placeholder="6 أحرف على الأقل" />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5">
                {showNewPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">تأكيد كلمة المرور</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="أعد كتابة كلمة المرور الجديدة" />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-red-500" />
                كلمة المرور غير متطابقة
              </p>
            )}
          </div>
          <div className="pt-2">
            <button
              onClick={handlePasswordChange}
              disabled={passwordMutation.isPending}
              className="flex items-center gap-2 bg-gradient-to-l from-orange-600 to-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري التغيير...</> : <><Lock size={16} /> تغيير كلمة المرور</>}
            </button>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="card p-6 space-y-5 animate-fade-in-scale">
          <div className="flex items-center gap-3 mb-1">
            <div className="gradient-purple p-2 rounded-lg text-white"><Palette size={18} /></div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">المظهر</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            اختر مظهر الواجهة المناسب لك. يمكنك أيضاً تبديل المظهر بسرعة من القائمة الجانبية.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const ThemeIcon = opt.icon
              const isActive = themeMode === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => applyTheme(opt.value)}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 text-center group ${
                    isActive
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                  }`}
                >
                  <div className="mb-3">
                    <div className={`inline-flex p-3 rounded-xl transition-colors ${isActive ? 'gradient-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'}`}>
                      <ThemeIcon size={22} />
                    </div>
                  </div>
                  <span className={`block text-sm font-semibold ${isActive ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500 mt-1">{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Tracking Veto - technicians only */}
      {current.role === 'technician' && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="gradient-green p-2 rounded-lg text-white"><MapPin size={18} /></div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">إعدادات التتبع</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${current.tracking_veto ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                <MapPin size={18} className={current.tracking_veto ? 'text-red-500' : 'text-emerald-500'} />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">إيقاف التتبع يدوياً</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {current.tracking_veto
                    ? 'التتبع موقوف يدوياً - لن ترى الإدارة موقعك'
                    : 'التتبع نشط - الإدارة ترى موقعك'}
                </p>
              </div>
            </div>
            <button
              onClick={() => vetoMutation.mutate(!current.tracking_veto)}
              disabled={vetoMutation.isPending}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                current.tracking_veto ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  current.tracking_veto ? '-translate-x-1.5' : '-translate-x-6.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}