import React from "react";

// Lightweight error boundary used during debugging to show render errors.
export default class DebugBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("[DebugBoundary] Caught error:", error, info);
  }

  render() {
    const st = (this as any).state;
    if (st && st.hasError) {
      const err = st.error;
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-3xl bg-white p-6 rounded-xl shadow-lg border border-red-100">
            <h2 className="text-xl font-bold text-red-700 mb-3">
              Dashboard render error
            </h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-red-50 p-3 rounded">
              {String(err && (err.message || err))}
            </pre>
            <p className="text-sm text-gray-600 mt-3">
              Check the browser console for full stack trace.
            </p>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}
