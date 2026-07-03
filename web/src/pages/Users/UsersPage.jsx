import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../services/users.service'
import { authApi } from '../../services/auth.service'
import {
  Search, Edit, ToggleLeft, ToggleRight, X, UserPlus,
  Shield, ShieldCheck, Wrench, Loader2, Users, Inbox
} from 'lucide-react'
import toast from 'react-hot-toast'

const roleIcons = { admin: Shield, support: ShieldCheck, technician: Wrench }
const roleLabels = { admin: 'مدير', support: 'دعم فني', technician: 'فني' }
const roleColors = {
  admin: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  support: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  technician: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    username: '', password: '', full_name: '', phone: '', email: ''
  })
  const queryClient = useQueryClient()

  const { data: usersData, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.getAll })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      toast.success('تم تحديث المستخدم بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const trackingMutation = useMutation({
    mutationFn: ({ id, enabled }) => usersApi.controlTracking(id, enabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(variables.enabled ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const registerMutation = useMutation({
    mutationFn: (data) => authApi.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAdd(false)
      setAddForm({ username: '', password: '', full_name: '', phone: '', email: '' })
      toast.success('تم إنشاء المستخدم بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const users = Array.isArray(usersData?.data) ? usersData.data : []

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  )

  const startEdit = (user) => {
    setEditingUser(user.id)
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      email: user.email || '',
      role: user.role,
      is_active: user.is_active !== false,
    })
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    updateMutation.mutate({ id: editingUser, data: editForm })
  }

  const handleAddSubmit = (e) => {
    e.preventDefault()
    registerMutation.mutate(addForm)
  }

  const resetAddForm = () => {
    setShowAdd(false)
    setAddForm({ username: '', password: '', full_name: '', phone: '', email: '' })
  }

  const inputClass = "input-field w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة المستخدمين</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة الصلاحيات والحسابات</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
        >
          <UserPlus size={17} />
          مستخدم جديد
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
        <input
          type="text"
          placeholder="بحث بالاسم أو اسم المستخدم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass + " pr-10"}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="gradient-blue p-2 rounded-lg text-white"><Users size={16} /></div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">إجمالي المستخدمين</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{users.length}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="gradient-green p-2 rounded-lg text-white"><ShieldCheck size={16} /></div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">نشطين</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{users.filter(u => u.is_active !== false).length}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="gradient-purple p-2 rounded-lg text-white"><Wrench size={16} /></div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">التتبع مفعل</div>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{users.filter(u => u.tracking_enabled && !u.tracking_veto).length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
              <Inbox size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">لا يوجد مستخدمين</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">أضف مستخدم جديد للبدء</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">المستخدم</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الصلاحية</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الهاتف</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">التتبع</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredUsers.map((u, idx) => {
                  const RoleIcon = roleIcons[u.role] || Wrench
                  return (
                    <tr key={u.id} className="table-row-hover hover:bg-gray-50/80 dark:hover:bg-gray-700/20 animate-fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl gradient-primary text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {u.full_name?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{u.full_name}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${roleColors[u.role] || ''}`}>
                          <RoleIcon size={12} />
                          {roleLabels[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{u.phone || '-'}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => trackingMutation.mutate({ id: u.id, enabled: !u.tracking_enabled })}
                          disabled={trackingMutation.isPending}
                          title={u.tracking_enabled ? 'إيقاف التتبع' : 'تفعيل التتبع'}
                          className="transition-transform hover:scale-110"
                        >
                          {u.tracking_veto ? (
                            <span className="text-xs text-red-500 dark:text-red-400 font-medium bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md">Veto</span>
                          ) : u.tracking_enabled ? (
                            <ToggleRight size={32} className="text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft size={32} className="text-gray-300 dark:text-gray-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${
                          u.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                            : 'bg-gray-50 text-gray-500 ring-1 ring-gray-500/20 dark:bg-gray-700/50 dark:text-gray-400 dark:ring-gray-600/20'
                        }`}>
                          {u.is_active !== false ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => startEdit(u)}
                          className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors group"
                          title="تعديل"
                        >
                          <Edit size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-fade-in-scale">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="gradient-primary p-2 rounded-lg text-white"><UserPlus size={18} /></div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">إضافة مستخدم جديد</h2>
              </div>
              <button onClick={resetAddForm} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                جميع المستخدمين الجدد يتم إنشاؤهم بصلاحية &quot;فني&quot;. لتغيير الصلاحية، عدّل المستخدم بعد الإنشاء.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">اسم المستخدم *</label>
                  <input type="text" required minLength={3} value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} className={inputClass} placeholder="username" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">كلمة المرور *</label>
                  <input type="password" required minLength={6} value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className={inputClass} placeholder="6 أحرف على الأقل" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الاسم الكامل *</label>
                <input type="text" required value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} className={inputClass} placeholder="الاسم الكامل" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الهاتف</label>
                  <input type="text" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className={inputClass} placeholder="05xxxxxxxx" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className={inputClass} placeholder="email@example.com" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={registerMutation.isPending} className="btn-primary flex-1 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {registerMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</> : 'إنشاء المستخدم'}
                </button>
                <button type="button" onClick={resetAddForm} className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-fade-in-scale">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="gradient-blue p-2 rounded-lg text-white"><Edit size={18} /></div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">تعديل المستخدم</h2>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الاسم الكامل</label>
                <input type="text" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الهاتف</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الصلاحية</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputClass}>
                    <option value="admin">مدير النظام</option>
                    <option value="support">دعم فني</option>
                    <option value="technician">فني</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الحالة</label>
                  <select value={editForm.is_active ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })} className={inputClass}>
                    <option value="true">نشط</option>
                    <option value="false">معطل</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {updateMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'حفظ التغييرات'}
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}