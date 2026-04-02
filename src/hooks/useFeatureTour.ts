'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'avalanche-tour-dismissed';
const VERSION_KEY = 'avalanche-tour-version';
const CURRENT_VERSION = '1.0';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  target?: string; // CSS selector or element ID
  highlightType?: 'spotlight' | 'tooltip' | 'none';
}

interface UseFeatureTourOptions {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  enabled?: boolean;
}

interface UseFeatureTourReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: string;
  next: () => void;
  back: () => void;
  skip: () => void;
  restart: () => void;
  dismissPermanently: () => void;
  setStep: (step: number) => void;
}

export function useFeatureTour({
  steps,
  onComplete,
  onSkip,
  enabled = true,
}: UseFeatureTourOptions): UseFeatureTourReturn {
  const searchParams = useSearchParams();
  const forceShow = searchParams.get('tour') === 'true';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if tour was permanently dismissed
  useEffect(() => {
    if (!enabled) return;
    
    const storedDismissed = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    // If version changed, reset dismissal
    if (storedVersion !== CURRENT_VERSION) {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      localStorage.removeItem(STORAGE_KEY);
      setDismissed(false);
    } else {
      setDismissed(storedDismissed === 'true');
    }
  }, [enabled]);

  // Auto-show on first login (no dismissal, no flag) or when forced
  useEffect(() => {
    if (!enabled || dismissed) return;
    
    const hasVisited = localStorage.getItem('avalanche-tour-visited');
    if (forceShow || !hasVisited) {
      setIsActive(true);
      setCurrentStep(0);
      if (!hasVisited) {
        localStorage.setItem('avalanche-tour-visited', 'true');
      }
    }
  }, [enabled, dismissed, forceShow]);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tour complete
      setIsActive(false);
      onComplete?.();
    }
  }, [currentStep, steps.length, onComplete]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsActive(false);
    onSkip?.();
  }, [onSkip]);

  const restart = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const dismissPermanently = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
    setIsActive(false);
  }, []);

  const setStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = `${currentStep + 1} of ${steps.length}`;
  const currentStepData = steps[currentStep] || null;

  return {
    isActive,
    currentStep,
    totalSteps: steps.length,
    currentStepData,
    isFirstStep,
    isLastStep,
    progress,
    next,
    back,
    skip,
    restart,
    dismissPermanently,
    setStep,
  };
}

// Hook to check if tour should auto-show
export function useShouldAutoShowTour(): boolean {
  const [shouldShow, setShouldShow] = useState(false);
  
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    const hasFlag = new URLSearchParams(window.location.search).get('tour') === 'true';
    
    setShouldShow(!dismissed || hasFlag);
  }, []);
  
  return shouldShow;
}
