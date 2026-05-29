import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    
    if (hasError) {
      return (
        <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[32px] flex items-center justify-center">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif italic text-white">문제가 발생했습니다</h2>
            <p className="text-stone-500 text-sm max-w-xs mx-auto leading-relaxed">
              앱을 불러오는 중에 예기치 못한 오류가 발생했습니다.
              {error?.message && (
                <span className="block mt-2 text-[10px] text-stone-700 font-mono break-all">
                  Error: {error.message}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-black/20"
          >
            <RefreshCw size={18} />
            <span>다시 시도하기</span>
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
