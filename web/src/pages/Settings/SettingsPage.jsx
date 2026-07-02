import { useState } from 'react'
import { useAuthStore } from '../hooks/useAuth'
import { authApi } from '../services/auth.service'
import { usersApi } from '../services/users.service'
import { User, Lock, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleProfileSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await usersApi.update(user.id, { full_name: fullName, phone, email })
      const updatedUser = { ...user, full_name: fullName, phone, email }
      const storage = localStorage.getItem('token') ? localStorage : sessionStorage
      storage.setItem('user', JSON.stringify(updatedUser))
      useAuthStore.setState({ user: updatedUser })
      toast.success('تم تحديث الملف الشخصي')
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ في التحديث')
    }
    setSaving(false)
  }

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error('يرجى ملء جميع الحقول'); return }
    if (newPassword !== confirmPassword) { toast.error('كلمة المرور غير متطابقة'); return }
    if (newPassword.length < 6) { toast.error('كلمة المرور 6 أحرف على الأقل'); return }
    setSaving(true)
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      toast.success('تم تغيير كلمة المرور')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ')
    }
    setSaving(false)
  }

  const tabs = [{ id: 'profile', label: 'الملف الشخصي', icon: User }, { id: 'password', label: 'تغيير كلمة المرور', icon: Lock }]

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{'الإعدادات'}</h1>
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => { const Icon = tab.icon; return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab===tab.id?'bg-primary text-white':'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
            <Icon size={18}/>{tab.label}
          </button>
        )})}
      </div>
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'اسم المستخدم'}</label>
            <input type="text" value={user?.username||''} disabled className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'الدور'}</label>
            <input type="text" value={user?.role==='admin'?'مدير النظام':user?.role==='support'?'دعم فني':'فني'} disabled className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'الاسم الكامل'}</label>
            <input type="text" value={fullName} onChange={(e)=>setFullName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'رقم الجوال'}</label>
            <input type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'البريد الإلكتروني'}</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <button onClick={handleProfileSave} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            <Save size={18}/>{saving?'جاري الحفظ...':'حفظ التغييرات'}</button>
        </div>
      )}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'كلمة المرور الحالية'}</label>
            <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'كلمة المرور الجديدة'}</label>
            <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{'تأكيد كلمة المرور'}</label>
            <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"/></div>
          <button onClick={handlePasswordChange} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            <Lock size={18}/>{saving?'جاري التغيير...':'تغيير كلمة المرور'}</button>
        </div>
      )}
    </div>
  )
}
