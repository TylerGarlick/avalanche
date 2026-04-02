'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { TourStep } from '@/hooks/useFeatureTour';

interface FeatureTourProps {
  steps: TourStep[];
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
  progress: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  isActive: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDismissPermanently: () => void;
}

export function FeatureTour({
  steps,
  currentStep,
  totalSteps,
  currentStepData,
  progress,
  isFirstStep,
  isLastStep,
  isActive,
  onNext,
  onBack,
  onSkip,
  onDismissPermanently,
}: FeatureTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showDontShowAgain, setShowDontShowAgain] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate target element position
  useEffect(() => {
    if (!isActive || !currentStepData?.target) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      try {
        const element = document.querySelector(currentStepData.target!);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      } catch {
        setTargetRect(null);
      }
    };

    updateRect();
    // Update on scroll and resize
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [isActive, currentStepData]);

  // Show "Don't show again" checkbox only on first step
  useEffect(() => {
    setShowDontShowAgain(isFirstStep);
    setDontShowAgain(false);
  }, [isFirstStep, isActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (dontShowAgain) {
            onDismissPermanently();
          } else {
            onSkip();
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          onBack();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onNext, onBack, onSkip, onDismissPermanently, dontShowAgain]);

  // Prevent body scroll when tour is active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive]);

  if (!isActive) return null;

  // Calculate spotlight cutout dimensions with padding
  const PADDING = 12;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
        borderRadius: '12px',
      }
    : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (dontShowAgain) {
            onDismissPermanently();
          } else {
            onSkip();
          }
        }}
      />

      {/* Spotlight cutout */}
      {spotlightStyle && (
        <div
          className="absolute pointer-events-none"
          style={{
            ...spotlightStyle,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
          }}
        />
      )}

      {/* Tour Card */}
      <div
        className="relative bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          position: 'absolute',
          bottom: spotlightStyle ? `${window.innerHeight - spotlightStyle.top}px` : '50%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '24px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏔️</span>
            <span className="text-slate-300 text-sm font-medium">Feature Tour</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm">{progress}</span>
            <button
              onClick={() => {
                if (dontShowAgain) {
                  onDismissPermanently();
                } else {
                  onSkip();
                }
              }}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
              aria-label="Close tour"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div className="px-5 pb-4">
          <h2 id="tour-title" className="text-white text-xl font-bold mb-2">
            {currentStepData?.title || 'Loading...'}
          </h2>
          <p id="tour-description" className="text-slate-300 text-base leading-relaxed">
            {currentStepData?.body || ''}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  // Allow clicking on dots to navigate (only to already visited steps)
                  if (index < currentStep) {
                    // We don't expose setStep here, so just visual feedback
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-500 w-4'
                    : index < currentStep
                    ? 'bg-slate-500 hover:bg-slate-400'
                    : 'bg-slate-700'
                }`}
                aria-label={`Go to step ${index + 1}`}
                aria-current={index === currentStep ? 'step' : undefined}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5">
          {/* Don't show again checkbox - only on first step */}
          {showDontShowAgain && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-slate-800 cursor-pointer"
                />
                <span className="text-slate-400 text-sm group-hover:text-slate-300">
                  Don&apos;t show again
                </span>
              </label>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={onBack}
              disabled={isFirstStep}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                isFirstStep
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Back
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Next / Finish button */}
            <button
              onClick={onNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span>← → Navigate</span>
            <span>Esc Skip</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeatureTour;
