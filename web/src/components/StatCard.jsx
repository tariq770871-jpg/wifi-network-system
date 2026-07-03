export default function StatCard({ title, value, icon: Icon, color = 'blue', index = 0 }) {
  const configs = {
    blue: {
      gradient: 'gradient-blue',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-100 dark:ring-blue-500/20',
    },
    green: {
      gradient: 'gradient-green',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-100 dark:ring-emerald-500/20',
    },
    orange: {
      gradient: 'gradient-orange',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-100 dark:ring-amber-500/20',
    },
    red: {
      gradient: 'gradient-red',
      bg: 'bg-red-50 dark:bg-red-500/10',
      text: 'text-red-600 dark:text-red-400',
      ring: 'ring-red-100 dark:ring-red-500/20',
    },
    purple: {
      gradient: 'gradient-purple',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      text: 'text-purple-600 dark:text-purple-400',
      ring: 'ring-purple-100 dark:ring-purple-500/20',
    },
  }

  const cfg = configs[color] || configs.blue

  return (
    <div
      className="card card-lift p-5 animate-fade-in-scale group"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
        </div>
        <div className={`${configs[color]?.gradient || cfg.gradient} p-3 rounded-xl shadow-md text-white group-hover:scale-105 transition-transform duration-300`}>
          <Icon size={22} />
        </div>
      </div>
      {/* Subtle accent bar */}
      <div className={`mt-4 h-1 rounded-full ${cfg.bg}`}>
        <div className={`h-full rounded-full ${cfg.gradient} w-2/3 opacity-60 group-hover:w-full group-hover:opacity-100 transition-all duration-500`} />
      </div>
    </div>
  )
}