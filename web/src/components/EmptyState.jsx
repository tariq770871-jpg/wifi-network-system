/**
 * EmptyState - حالة فراغ موحدة (criterion 4: UX)
 * تُستخدم عند عدم وجود بيانات في أي قائمة/جدول
 */
export default function EmptyState({ icon: Icon, title = 'لا توجد بيانات', description = 'لم يتم العثور على أي عناصر لعرضها', action }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
