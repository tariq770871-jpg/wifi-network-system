import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
          <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-red-500">&#9888;</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">حدث خطأ غير متوقع</h2>
            <p className="text-gray-500 mb-4 text-sm">عذراً، حدث خطأ أثناء تحميل الصفحة</p>
            <details className="text-right bg-gray-50 rounded-lg p-3 mb-4">
              <summary className="text-xs text-gray-400 cursor-pointer">تفاصيل الخطأ</summary>
              <pre className="mt-2 text-xs text-red-500 overflow-auto max-h-32 whitespace-pre-wrap" dir="ltr">
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/login'; }}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
