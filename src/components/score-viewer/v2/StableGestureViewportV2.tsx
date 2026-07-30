import React, { ReactNode } from 'react';
import { STABLE_IDENTITY_TRANSFORM_V2 } from './stableGestureTypes';

interface Props {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export const StableGestureViewportV2 = React.forwardRef<HTMLDivElement, Props>(
  ({ children, className = '', ariaLabel }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        aria-label={ariaLabel}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Centering Layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '12px',
            boxSizing: 'border-box'
          }}
        >
          {/* Transform Layer */}
          <div
            style={{
              display: 'inline-block',
              position: 'relative',
              flex: 'none',
              transformOrigin: '0 0',
              transform: `translate3d(${STABLE_IDENTITY_TRANSFORM_V2.translateX}px, ${STABLE_IDENTITY_TRANSFORM_V2.translateY}px, 0) scale(${STABLE_IDENTITY_TRANSFORM_V2.scale})`
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
);
StableGestureViewportV2.displayName = 'StableGestureViewportV2';
export default StableGestureViewportV2;
