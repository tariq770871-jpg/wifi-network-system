import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../services/auth.service'
import { usersApi } from '../../services/users.service'
import { useAuthStore } from '../../hooks/useAuth'
import { User, Lock, Save, MapPin, Eye, EyeOff, Palette, Sun, Moon, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'

const THEME_KEY = 'theme'

const themeOptions = [
  { value: 'light', label: 'وضع فاتح' },
  { value: 'dark', label: 'وضع داكن' },
  { value: 'auto', label: 'تلقائي (حسب النظام)' },
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
      toast.success('تم تحديث الملف الشخصي')
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
      toast.success('تم تغيير كلمة المرور')
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
      toast.success('تم التحديث')
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

  const roleLabels = { admin: 'مدير النظام', support: 'دعم فني', technician: 'فني' }
  const tabs = [
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'password', label: 'تغيير كلمة المرور', icon: Lock },
    { id: 'appearance', label: 'المظهر', icon: Palette },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الإعدادات</h1>

      {/* User info card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">
            {current.full_name?.[0] || 'U'}
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900 dark:text-white">{current.full_name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              @{current.username} &middot; {roleLabels[current.role] || current.role}
            </p>
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <User size={20} className="text-primary" />
            الملف الشخصي
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم</label>
            <input
              type="text"
              value={current.username || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الجوال</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="05xxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>
          <button
            onClick={handleProfileSave}
            disabled={profileMutation.isPending}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {profileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Lock size={20} className="text-orange-600" />
            تغيير كلمة المرور
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور الحالية</label>
            <div className="relative">
              <input
                type={showCurrentPwd ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent pl-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showCurrentPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent pl-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">كلمة المرور غير متطابقة</p>
            )}
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={passwordMutation.isPending}
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            <Lock size={18} />
            {passwordMutation.isPending ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
          </button>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Palette size={20} className="text-primary" />
            المظهر
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            اختر مظهر الواجهة المناسب لك. يمكنك أيضاً تبديل المظهر بسرعة من القائمة الجانبية.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => applyTheme(opt.value)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  themeMode === opt.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">
                  {opt.value === 'light' && <Sun size={24} className="mx-auto text-yellow-500" />}
                  {opt.value === 'dark' && <Moon size={24} className="mx-auto text-blue-400" />}
                  {opt.value === 'auto' && <Monitor size={24} className="mx-auto text-gray-500 dark:text-gray-400" />}
                </div>
                <span className={`text-sm font-medium ${themeMode === opt.value ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tracking Veto - technicians only */}
      {current.role === 'technician' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
            <MapPin size={20} className="text-green-600" />
            إعدادات التتبع
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <MapPin size={20} className={current.tracking_veto ? 'text-red-500' : 'text-green-500'} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">إيقاف التتبع يدوياً</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {current.tracking_veto
                    ? 'التتبع موقوف يدوياً - لن يرى الإدارة موقعك'
                    : 'التتبع نشط - الإدارة ترى موقعك'}
                </p>
              </div>
            </div>
            <button
              onClick={() => vetoMutation.mutate(!current.tracking_veto)}
              disabled={vetoMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                current.tracking_veto ? 'bg-red-500' : 'bg-green-500'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  current.tracking_veto ? '-translate-x-1' : '-translate-x-6'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}