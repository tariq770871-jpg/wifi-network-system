import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../services/users.service'
import { useAuthStore } from '../../hooks/useAuth'
import {
  Search, Edit, ToggleLeft, ToggleRight, X, UserPlus,
  Shield, ShieldCheck, Wrench, Loader2, Users, Inbox, KeyRound, Trash2, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const roleIcons = { admin: Shield, support: ShieldCheck, technician: Wrench }
const roleLabels = { admin: 'مدير', support: 'دعم فني', technician: 'فني' }
const roleColors = {
  admin: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  support: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  technician: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
}

// إبطال موحد — مزامنة التبويبات: المستخدمون + الداشبورد + التذاكر (المكلفون/المعيّنون)
const invalidateUsersSync = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['users'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['tickets'] })
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    username: '', password: '', full_name: '', role: 'technician', phone: '', email: ''
  })
  const [deletingUser, setDeletingUser] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  // الشكل الصحيح لاستجابة GET /users: { data: { items: [...], pagination } }
  // البحث يذهب للخادم (يعمل عبر كل الصفحات) — debounce بسيط عبر queryKey
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.getAll(search.trim() ? { search: search.trim() } : {}),
  })
  const users = Array.isArray(usersData?.data?.items) ? usersData.data.items : []

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: () => {
      invalidateUsersSync(queryClient)
      setEditingUser(null)
      toast.success('تم تحديث المستخدم بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const trackingMutation = useMutation({
    mutationFn: ({ id, enabled }) => usersApi.controlTracking(id, enabled),
    onSuccess: (_, variables) => {
      invalidateUsersSync(queryClient)
      toast.success(variables.enabled ? 'تم تفعيل التتبع' : 'تم إيقاف التتبع')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const createMutation = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      invalidateUsersSync(queryClient)
      setShowAdd(false)
      setAddForm({ username: '', password: '', full_name: '', role: 'technician', phone: '', email: '' })
      toast.success('تم إنشاء المستخدم بنجاح — ظهر في القائمة الآن')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      invalidateUsersSync(queryClient)
      setDeletingUser(null)
      toast.success('تم حذف المستخدم نهائياً')
    },
    onError: (err) => {
      setDeletingUser(null)
      toast.error(err.response?.data?.error || 'حدث خطأ أثناء الحذف')
    },
  })

  const resetMutation = useMutation({
    mutationFn: ({ id, password }) => usersApi.resetPassword(id, password),
    onSuccess: () => {
      setResetTarget(null)
      setResetPassword('')
      toast.success('تم إعادة تعيين كلمة المرور — أبلغ المستخدم بكلمة المرور الجديدة')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

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
    createMutation.mutate(addForm)
  }

  const handleDeleteConfirm = () => {
    if (deletingUser) deleteMutation.mutate(deletingUser.id)
  }

  const handleResetSubmit = (e) => {
    e.preventDefault()
    if (resetTarget) resetMutation.mutate({ id: resetTarget, password: resetPassword })
  }

  const resetAddForm = () => {
    setShowAdd(false)
    setAddForm({ username: '', password: '', full_name: '', role: 'technician', phone: '', email: '' })
  }

  const inputClass = "input-field w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"

  const isSelf = (u) => currentUser?.id != null && Number(u.id) === Number(currentUser.id)

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
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
              <Inbox size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">لا يوجد مستخدمين</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">أضف مستخدم جديد للبدء</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
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
                {users.map((u, idx) => {
                  const RoleIcon = roleIcons[u.role] || Wrench
                  const self = isSelf(u)
                  return (
                    <tr key={u.id} className="table-row-hover hover:bg-gray-50/80 dark:hover:bg-gray-700/20 animate-fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl gradient-primary text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {u.full_name?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">
                              {u.full_name}
                              {self && <span className="text-xs text-gray-400 font-normal"> (أنت)</span>}
                            </div>
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
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(u)}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors group"
                            title="تعديل"
                          >
                            <Edit size={16} className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                          </button>
                          <button
                            onClick={() => { setResetTarget(u.id); setResetPassword('') }}
                            className="p-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors group"
                            title="إعادة تعيين كلمة المرور"
                          >
                            <KeyRound size={16} className="text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={self}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors group disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={self ? 'لا يمكنك حذف حسابك الخاص' : 'حذف المستخدم نهائياً'}
                          >
                            <Trash2 size={16} className="text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                          </button>
                        </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="add-username" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">اسم المستخدم *</label>
                  <input id="add-username" type="text" required minLength={3} value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} className={inputClass} placeholder="username" />
                </div>
                <div>
                  <label htmlFor="add-password" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">كلمة المرور *</label>
                  <input id="add-password" type="password" required minLength={6} value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className={inputClass} placeholder="6 أحرف على الأقل" />
                </div>
              </div>
              <div>
                <label htmlFor="add-fullname" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الاسم الكامل *</label>
                <input id="add-fullname" type="text" required value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} className={inputClass} placeholder="الاسم الكامل" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="add-role" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الصلاحية *</label>
                  <select id="add-role" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} className={inputClass}>
                    <option value="technician">فني</option>
                    <option value="support">دعم فني</option>
                    <option value="admin">مدير النظام</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="add-phone" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الهاتف</label>
                  <input id="add-phone" type="text" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className={inputClass} placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div>
                <label htmlFor="add-email" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
                <input id="add-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className={inputClass} placeholder="email@example.com" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {createMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</> : 'إنشاء المستخدم'}
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
                <label htmlFor="edit-fullname" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الاسم الكامل</label>
                <input id="edit-fullname" type="text" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-phone" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الهاتف</label>
                  <input id="edit-phone" type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
                  <input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-role" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الصلاحية</label>
                  <select id="edit-role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputClass}>
                    <option value="admin">مدير النظام</option>
                    <option value="support">دعم فني</option>
                    <option value="technician">فني</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-active" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">الحالة</label>
                  <select id="edit-active" value={editForm.is_active ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })} className={inputClass}>
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

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-fade-in-scale">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"><AlertTriangle size={20} /></div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">حذف المستخدم نهائياً؟</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                أنت على وشك حذف حساب <span className="font-bold">{deletingUser.full_name}</span> (<span dir="ltr">@{deletingUser.username}</span>) نهائياً. لا يمكن التراجع عن هذا الإجراء.
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc list-inside bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3.5">
                <li>لن يستطيع المستخدم تسجيل الدخول بعد الآن</li>
                <li>سجلات تتبعه السابقة تُحذف نهائياً</li>
                <li>تذاكره ونقاطه تبقى في النظام دون ربط بحسابه</li>
                <li>حساب آخر مدير نشط في النظام محمي من الحذف</li>
              </ul>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {deleteMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري الحذف...</> : 'نعم، احذف نهائياً'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-fade-in-scale">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="gradient-purple p-2 rounded-lg text-white"><KeyRound size={18} /></div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">إعادة تعيين كلمة المرور</h2>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleResetSubmit} className="p-5 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                أدخل كلمة مرور جديدة للمستخدم. كلمة المرور الحالية ستصبح غير صالحة فوراً.
              </p>
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">كلمة المرور الجديدة *</label>
                <input
                  id="reset-password"
                  type="text"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className={inputClass}
                  placeholder="6 أحرف على الأقل"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={resetMutation.isPending} className="btn-primary flex-1 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {resetMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> جاري التعيين...</> : 'تعيين كلمة المرور'}
                </button>
                <button type="button" onClick={() => setResetTarget(null)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
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
