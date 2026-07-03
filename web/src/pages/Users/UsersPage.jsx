import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../services/users.service'
import { authApi } from '../../services/auth.service'
import {
  Search, Edit, ToggleLeft, ToggleRight, X, UserPlus,
  Shield, ShieldCheck, Wrench
} from 'lucide-react'
import toast from 'react-hot-toast'

const roleIcons = { admin: Shield, support: ShieldCheck, technician: Wrench }
const roleLabels = { admin: 'مدير', support: 'دعم فني', technician: 'فني' }
const roleColors = {
  admin: 'bg-red-100 text-red-700',
  support: 'bg-blue-100 text-blue-700',
  technician: 'bg-green-100 text-green-700',
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
      toast.success('تم تحديث المستخدم')
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
      toast.success('تم إنشاء المستخدم')
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          <UserPlus size={18} />
          مستخدم جديد
        </button>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">إضافة مستخدم جديد</h2>
              <button
                onClick={() => { setShowAdd(false); setAddForm({ username: '', password: '', full_name: '', phone: '', email: '' }) }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-4 space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                جميع المستخدمين الجدد يتم إنشاؤهم بصلاحية "فني". لتغيير الصلاحية، عدّل المستخدم بعد الإنشاء.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المستخدم *</label>
                  <input
                    type="text" required minLength={3}
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">كلمة المرور *</label>
                  <input
                    type="password" required minLength={6}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم الكامل *</label>
                <input
                  type="text" required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الهاتف</label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit" disabled={registerMutation.isPending}
                  className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  {registerMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddForm({ username: '', password: '', full_name: '', phone: '', email: '' }) }}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">إجمالي المستخدمين</div>
          <div className="text-2xl font-bold text-primary">{users.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">نشطين</div>
          <div className="text-2xl font-bold text-green-600">{users.filter(u => u.is_active !== false).length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">التتبع مفعل</div>
          <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.tracking_enabled && !u.tracking_veto).length}</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">المستخدم</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الصلاحية</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الهاتف</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">التتبع</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">جاري التحميل...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">لا يوجد مستخدمين</td></tr>
            ) : (
              filteredUsers.map((u) => {
                const RoleIcon = roleIcons[u.role] || Wrench
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                          {u.full_name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-medium">{u.full_name}</div>
                          <div className="text-xs text-gray-500">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || ''}`}>
                        <RoleIcon size={12} />
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => trackingMutation.mutate({ id: u.id, enabled: !u.tracking_enabled })}
                        disabled={trackingMutation.isPending}
                        title={u.tracking_enabled ? 'إيقاف التتبع' : 'تفعيل التتبع'}
                      >
                        {u.tracking_veto ? (
                          <span className="text-xs text-red-500 font-medium">Veto</span>
                        ) : u.tracking_enabled ? (
                          <ToggleRight size={28} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={28} className="text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active !== false ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startEdit(u)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit size={16} className="text-blue-600" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">تعديل المستخدم</h2>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم الكامل</label>
                <input
                  type="text" required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الهاتف</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الصلاحية</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="admin">مدير النظام</option>
                    <option value="support">دعم فني</option>
                    <option value="technician">فني</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الحالة</label>
                  <select
                    value={editForm.is_active ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="true">نشط</option>
                    <option value="false">معطل</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit" disabled={updateMutation.isPending}
                  className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
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